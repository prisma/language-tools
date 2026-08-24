import path from 'node:path'
import { stat } from 'node:fs/promises'
import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from 'node:child_process'
import type { Disposable, TextDocument, Uri, WorkspaceFolder } from 'vscode'
import type { LanguageClientOptions } from 'vscode-languageclient'
import type { ChildProcessInfo, LanguageClient, ServerOptions } from 'vscode-languageclient/node'
import type { DocumentOwnershipCoordinator } from './documentOwnership'
import { createLocalClientMiddleware, type LocalClientMiddleware } from './localClientMiddleware'

const prismaCliRelativePath = ['node_modules', 'prisma', 'dist', 'prisma.js'] as const

export const localPrismaNextClientTestStateCommand = 'prisma.test.localPrismaNextClientState'

export interface LocalPrismaNextClientRegistryWorkspace {
  readonly isTrusted: boolean
  getWorkspaceFolder(uri: Uri): WorkspaceFolder | undefined
}

export type SpawnLocalPrismaNextProcess = (
  executable: string,
  args: string[],
  options: SpawnOptionsWithoutStdio,
) => ChildProcessWithoutNullStreams

export interface LocalPrismaNextLauncherOptions {
  readonly executable?: string
  readonly environment?: NodeJS.ProcessEnv
  readonly spawnProcess?: SpawnLocalPrismaNextProcess
  readonly handleProcessError?: (error: Error) => void
}

export interface LocalPrismaNextClientRegistryOptions {
  readonly workspace: LocalPrismaNextClientRegistryWorkspace
  readonly ownership: DocumentOwnershipCoordinator
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
  readonly launcher?: Omit<LocalPrismaNextLauncherOptions, 'handleProcessError'>
}

export interface LocalPrismaNextClientTestState {
  readonly startedWorkspaceFolderUris: readonly string[]
}

interface LocalPrismaNextClientEntry {
  readonly client: LanguageClient
  readonly middleware: LocalClientMiddleware
}

export class LocalPrismaNextClientRegistry {
  private readonly clients = new Map<string, Promise<LocalPrismaNextClientEntry | undefined>>()
  private readonly startedClients = new Map<string, LocalPrismaNextClientEntry>()

  constructor(private readonly options: LocalPrismaNextClientRegistryOptions) {}

  ensureClientForDocument(document: TextDocument): Promise<LanguageClient | undefined> {
    if (!this.options.workspace.isTrusted || document.uri.scheme !== 'file') {
      return Promise.resolve(undefined)
    }

    const workspaceFolder = this.options.workspace.getWorkspaceFolder(document.uri)
    if (!workspaceFolder || workspaceFolder.uri.scheme !== 'file') {
      return Promise.resolve(undefined)
    }

    return this.ensureClient(workspaceFolder).then((entry) => entry?.client)
  }

  async openDocument(workspaceFolderUri: string, document: TextDocument): Promise<void> {
    const entry = await this.clients.get(workspaceFolderUri)
    entry?.middleware.openDocument(document)
  }

  async closeDocument(workspaceFolderUri: string, document: TextDocument): Promise<void> {
    const entry = await this.clients.get(workspaceFolderUri)
    entry?.middleware.closeDocument(document)
  }

  async clearDiagnostics(workspaceFolderUri: string, uri: Uri): Promise<void> {
    const entry = await this.clients.get(workspaceFolderUri)
    entry?.middleware.clearDiagnostics(uri)
  }

  getTestState(): LocalPrismaNextClientTestState {
    return {
      startedWorkspaceFolderUris: [...this.startedClients.keys()].sort(),
    }
  }

  private ensureClient(workspaceFolder: WorkspaceFolder): Promise<LocalPrismaNextClientEntry | undefined> {
    const workspaceFolderUri = workspaceFolder.uri.toString()
    const existing = this.clients.get(workspaceFolderUri)
    if (existing) {
      return existing
    }

    const pending = Promise.resolve().then(() => this.discoverAndStart(workspaceFolder))
    this.clients.set(workspaceFolderUri, pending)
    return pending
  }

  private async discoverAndStart(workspaceFolder: WorkspaceFolder): Promise<LocalPrismaNextClientEntry | undefined> {
    const entrypoint = getLocalPrismaNextEntrypoint(workspaceFolder)

    try {
      const exists = await (this.options.entrypointExists ?? isFile)(entrypoint)
      if (!exists) {
        return undefined
      }

      const workspaceFolderUri = workspaceFolder.uri.toString()
      const middleware = createLocalClientMiddleware({
        workspaceFolderUri,
        ownership: this.options.ownership,
        getClient: () => client,
        getDocument: this.options.getDocument,
      })
      const client = this.options.createClient(
        `prisma-next:${workspaceFolderUri}`,
        `Prisma Next Language Server (${workspaceFolder.name})`,
        createLocalPrismaNextServerOptions(workspaceFolder, entrypoint, {
          ...this.options.launcher,
          handleProcessError: (error) => this.options.handleStartError?.(workspaceFolder, error),
        }),
        createLocalPrismaNextClientOptions(workspaceFolder, middleware),
      )
      this.options.registerDisposable(client.start())
      await client.onReady()
      const entry = { client, middleware }
      this.startedClients.set(workspaceFolderUri, entry)
      return entry
    } catch (error) {
      this.options.handleStartError?.(workspaceFolder, error)
      return undefined
    }
  }
}

export function getLocalPrismaNextEntrypoint(workspaceFolder: WorkspaceFolder): string {
  return path.join(workspaceFolder.uri.fsPath, ...prismaCliRelativePath)
}

export function createLocalPrismaNextServerOptions(
  workspaceFolder: WorkspaceFolder,
  entrypoint = getLocalPrismaNextEntrypoint(workspaceFolder),
  launcher: LocalPrismaNextLauncherOptions = {},
): ServerOptions {
  return () =>
    launchLocalPrismaNextServer({
      executable: launcher.executable ?? process.execPath,
      entrypoint,
      cwd: workspaceFolder.uri.fsPath,
      environment: createExtensionHostNodeEnvironment(launcher.environment ?? process.env),
      spawnProcess: launcher.spawnProcess ?? spawn,
      handleProcessError: launcher.handleProcessError,
    })
}

export interface LaunchLocalPrismaNextServerOptions {
  readonly executable: string
  readonly entrypoint: string
  readonly cwd: string
  readonly environment: NodeJS.ProcessEnv
  readonly spawnProcess: SpawnLocalPrismaNextProcess
  readonly handleProcessError?: (error: Error) => void
}

export function launchLocalPrismaNextServer(options: LaunchLocalPrismaNextServerOptions): Promise<ChildProcessInfo> {
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

export function createLocalPrismaNextClientOptions(
  workspaceFolder: WorkspaceFolder,
  middleware: LocalClientMiddleware,
): LanguageClientOptions {
  const rootPath = workspaceFolder.uri.fsPath.split('\\').join('/')
  const normalizedRoot = rootPath.endsWith('/') ? rootPath.slice(0, -1) : rootPath
  return {
    documentSelector: [{ language: 'prisma', scheme: 'file', pattern: `${normalizedRoot}/**/*` }],
    workspaceFolder,
    middleware,
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
