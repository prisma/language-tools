import path from 'node:path'
import { stat } from 'node:fs/promises'
import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from 'node:child_process'
import type { Disposable, TextDocument, Uri, WorkspaceFolder } from 'vscode'
import { CloseAction, ErrorAction, type LanguageClientOptions } from 'vscode-languageclient'
import type { ChildProcessInfo, LanguageClient, ServerOptions } from 'vscode-languageclient/node'
import type { DocumentOwnershipCoordinator } from './documentOwnership'
import { createPrismaNextClientMiddleware, type PrismaNextClientMiddleware } from './prismaNextClientMiddleware'

const prismaCliRelativePath = ['node_modules', 'prisma', 'dist', 'prisma.js'] as const

export interface PrismaNextClientRegistryWorkspace {
  readonly isTrusted: boolean
  getWorkspaceFolder(uri: Uri): WorkspaceFolder | undefined
}

export type SpawnPrismaNextProcess = (
  executable: string,
  args: string[],
  options: SpawnOptionsWithoutStdio,
) => ChildProcessWithoutNullStreams

export interface PrismaNextLauncherOptions {
  readonly executable?: string
  readonly environment?: NodeJS.ProcessEnv
  readonly spawnProcess?: SpawnPrismaNextProcess
  readonly handleProcessError?: (error: Error) => void
}

export interface PrismaNextClientRegistryOptions {
  readonly workspace: PrismaNextClientRegistryWorkspace
  readonly ownership: DocumentOwnershipCoordinator
  readonly isActive: () => boolean
  readonly getDocument: (uri: Uri) => TextDocument | undefined
  readonly createClient: (
    id: string,
    name: string,
    serverOptions: ServerOptions,
    clientOptions: LanguageClientOptions,
  ) => LanguageClient
  readonly registerDisposable: (disposable: Disposable) => void
  readonly entrypointExists?: (entrypoint: string) => Promise<boolean>
  readonly handleStartError?: (workspaceFolder: WorkspaceFolder, error: unknown) => void
  readonly launcher?: Omit<PrismaNextLauncherOptions, 'handleProcessError'>
}

interface PrismaNextClientEntry {
  readonly client: LanguageClient
  readonly middleware: PrismaNextClientMiddleware
}

export class PrismaNextClientRegistry {
  private readonly clients = new Map<string, Promise<PrismaNextClientEntry | undefined>>()
  private readonly startedClients = new Set<LanguageClient>()
  private disposed = false
  private deactivation: Promise<void> | undefined

  constructor(private readonly options: PrismaNextClientRegistryOptions) {}

  ensureClientForDocument(document: TextDocument): Promise<LanguageClient | undefined> {
    if (
      this.disposed ||
      !this.options.isActive() ||
      !this.options.workspace.isTrusted ||
      document.uri.scheme !== 'file'
    ) {
      return Promise.resolve(undefined)
    }

    const workspaceFolder = this.options.workspace.getWorkspaceFolder(document.uri)
    if (workspaceFolder?.uri.scheme !== 'file') {
      return Promise.resolve(undefined)
    }

    return this.ensureClient(workspaceFolder).then((entry) => entry?.client)
  }

  async openDocument(workspaceFolderUri: string, document: TextDocument): Promise<boolean> {
    if (this.disposed || !this.options.isActive()) return false

    const entry = await this.clients.get(workspaceFolderUri)
    if (this.disposed || !this.options.isActive() || !entry || this.options.getDocument(document.uri) !== document) {
      return false
    }
    entry.middleware.openDocument(document)
    return true
  }

  async closeDocument(workspaceFolderUri: string, document: TextDocument): Promise<void> {
    if (this.disposed || !this.options.isActive()) return

    const entry = await this.clients.get(workspaceFolderUri)
    if (!this.disposed && this.options.isActive()) entry?.middleware.closeDocument(document)
  }

  async clearDiagnostics(workspaceFolderUri: string, uri: Uri): Promise<void> {
    if (this.disposed || !this.options.isActive()) return

    const entry = await this.clients.get(workspaceFolderUri)
    if (!this.disposed && this.options.isActive()) entry?.middleware.clearDiagnostics(uri)
  }

  dispose(): Promise<void> {
    if (this.deactivation) return this.deactivation

    this.disposed = true
    this.deactivation = Promise.allSettled([...this.startedClients].map((client) => client.stop())).then(
      () => undefined,
    )
    return this.deactivation
  }

  private ensureClient(workspaceFolder: WorkspaceFolder): Promise<PrismaNextClientEntry | undefined> {
    if (this.disposed || !this.options.isActive()) return Promise.resolve(undefined)

    const workspaceFolderUri = workspaceFolder.uri.toString()
    const existing = this.clients.get(workspaceFolderUri)
    if (existing) {
      return existing
    }

    const pending = Promise.resolve().then(() => this.discoverAndStart(workspaceFolder))
    this.clients.set(workspaceFolderUri, pending)
    void pending.then((entry) => {
      if (!entry && this.clients.get(workspaceFolderUri) === pending) {
        this.clients.delete(workspaceFolderUri)
      }
    })
    return pending
  }

  private async discoverAndStart(workspaceFolder: WorkspaceFolder): Promise<PrismaNextClientEntry | undefined> {
    const entrypoint = getPrismaNextEntrypoint(workspaceFolder)
    let client: LanguageClient | undefined
    const getClient = (): LanguageClient => {
      if (!client) throw new Error('Prisma Next language client is not initialized')
      return client
    }

    try {
      const exists = await (this.options.entrypointExists ?? isFile)(entrypoint)
      if (!exists || this.disposed || !this.options.isActive()) {
        return undefined
      }

      const workspaceFolderUri = workspaceFolder.uri.toString()
      const middleware = createPrismaNextClientMiddleware({
        workspaceFolderUri,
        ownership: this.options.ownership,
        isActive: this.options.isActive,
        getClient,
        getDocument: this.options.getDocument,
      })
      if (this.disposed || !this.options.isActive()) return undefined

      client = this.options.createClient(
        `prisma-next:${workspaceFolderUri}`,
        `Prisma Next Language Server (${workspaceFolder.name})`,
        createPrismaNextServerOptions(workspaceFolder, entrypoint, {
          ...this.options.launcher,
          handleProcessError: (error) => this.options.handleStartError?.(workspaceFolder, error),
        }),
        createPrismaNextClientOptions(workspaceFolder, middleware),
      )
      this.startedClients.add(client)
      if (this.disposed || !this.options.isActive()) {
        await client.stop()
        return undefined
      }
      this.options.registerDisposable(client.start())
      await client.onReady()
      if (this.disposed || !this.options.isActive()) return undefined
      return { client, middleware }
    } catch (error) {
      if (client) {
        try {
          await client.stop()
          this.startedClients.delete(client)
        } catch {
          // Deactivation retries cleanup for clients that could not be stopped here.
        }
      }
      if (!this.disposed && this.options.isActive()) {
        this.options.handleStartError?.(workspaceFolder, error)
      }
      return undefined
    }
  }
}

export function getPrismaNextEntrypoint(workspaceFolder: WorkspaceFolder): string {
  return path.join(workspaceFolder.uri.fsPath, ...prismaCliRelativePath)
}

export function createPrismaNextServerOptions(
  workspaceFolder: WorkspaceFolder,
  entrypoint = getPrismaNextEntrypoint(workspaceFolder),
  launcher: PrismaNextLauncherOptions = {},
): ServerOptions {
  return () =>
    launchPrismaNextServer({
      executable: launcher.executable ?? process.execPath,
      entrypoint,
      cwd: workspaceFolder.uri.fsPath,
      environment: createExtensionHostNodeEnvironment(launcher.environment ?? process.env),
      spawnProcess: launcher.spawnProcess ?? spawn,
      handleProcessError: launcher.handleProcessError,
    })
}

export interface LaunchPrismaNextServerOptions {
  readonly executable: string
  readonly entrypoint: string
  readonly cwd: string
  readonly environment: NodeJS.ProcessEnv
  readonly spawnProcess: SpawnPrismaNextProcess
  readonly handleProcessError?: (error: Error) => void
}

export function launchPrismaNextServer(options: LaunchPrismaNextServerOptions): Promise<ChildProcessInfo> {
  return new Promise((resolve, reject) => {
    const child = options.spawnProcess(options.executable, [options.entrypoint, 'lsp'], {
      cwd: options.cwd,
      env: options.environment,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const cleanupStartupListeners = (): void => {
      child.removeListener('error', handleStartupError)
      child.removeListener('spawn', handleSpawn)
    }
    const handleStartupError = (error: Error): void => {
      cleanupStartupListeners()
      destroyProcessStreams(child)
      if (child.pid !== undefined && !child.killed) {
        child.kill()
      }
      reject(error)
    }
    const handleSpawn = (): void => {
      cleanupStartupListeners()
      const handleProcessError = (error: Error): void => {
        child.removeListener('close', handleClose)
        options.handleProcessError?.(error)
      }
      const handleClose = (): void => {
        child.removeListener('error', handleProcessError)
      }
      child.once('error', handleProcessError)
      child.once('close', handleClose)
      resolve({ process: child, detached: false })
    }

    child.once('error', handleStartupError)
    child.once('spawn', handleSpawn)
  })
}

export function createExtensionHostNodeEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...environment,
    ELECTRON_RUN_AS_NODE: '1',
    ELECTRON_NO_ASAR: '1',
  }
}

function destroyProcessStreams(child: ChildProcessWithoutNullStreams): void {
  child.stdin.destroy()
  child.stdout.destroy()
  child.stderr.destroy()
}

export function createPrismaNextClientOptions(
  workspaceFolder: WorkspaceFolder,
  middleware: PrismaNextClientMiddleware,
): LanguageClientOptions {
  const rootPath = workspaceFolder.uri.fsPath.split('\\').join('/')
  const normalizedRoot = rootPath.endsWith('/') ? rootPath.slice(0, -1) : rootPath
  return {
    documentSelector: [{ language: 'prisma', scheme: 'file', pattern: `${normalizedRoot}/**/*` }],
    workspaceFolder,
    middleware,
    initializationFailedHandler: () => false,
    errorHandler: {
      error: () => ErrorAction.Shutdown,
      closed: () => CloseAction.DoNotRestart,
    },
  }
}

async function isFile(entrypoint: string): Promise<boolean> {
  try {
    return (await stat(entrypoint)).isFile()
  } catch (error) {
    if (isMissingPathError(error)) {
      return false
    }
    throw error
  }
}

function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  )
}
