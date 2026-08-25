import path from 'node:path'
import { stat } from 'node:fs/promises'
import { fork, type ChildProcess, type ForkOptions } from 'node:child_process'
import type { Disposable, TextDocument, Uri, WorkspaceFolder } from 'vscode'
import type { LanguageClientOptions } from 'vscode-languageclient'
import type { ChildProcessInfo, LanguageClient, ServerOptions } from 'vscode-languageclient/node'
import type { DocumentOwnershipCoordinator } from './documentOwnership'
import { createLocalClientMiddleware, type LocalClientMiddleware } from './localClientMiddleware'

const prismaCliRelativePath = ['node_modules', 'prisma', 'dist', 'prisma.js'] as const

export interface LocalPrismaNextClientRegistryWorkspace {
  readonly isTrusted: boolean
  getWorkspaceFolder(uri: Uri): WorkspaceFolder | undefined
}

export type ForkLocalPrismaNextProcess = (modulePath: string, args: string[], options: ForkOptions) => ChildProcess

export interface LocalPrismaNextLauncherOptions {
  readonly environment?: NodeJS.ProcessEnv
  readonly forkProcess?: ForkLocalPrismaNextProcess
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

interface LocalPrismaNextClientEntry {
  readonly client: LanguageClient
  readonly middleware: LocalClientMiddleware
}

export class LocalPrismaNextClientRegistry {
  private readonly clients = new Map<string, Promise<LocalPrismaNextClientEntry | undefined>>()

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

  async openDocument(workspaceFolderUri: string, document: TextDocument): Promise<boolean> {
    const entry = await this.clients.get(workspaceFolderUri)
    if (!entry || this.options.getDocument(document.uri) !== document) {
      return false
    }
    entry.middleware.openDocument(document)
    return true
  }

  async closeDocument(workspaceFolderUri: string, document: TextDocument): Promise<void> {
    const entry = await this.clients.get(workspaceFolderUri)
    entry?.middleware.closeDocument(document)
  }

  async clearDiagnostics(workspaceFolderUri: string, uri: Uri): Promise<void> {
    const entry = await this.clients.get(workspaceFolderUri)
    entry?.middleware.clearDiagnostics(uri)
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
      return { client, middleware }
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
      entrypoint,
      cwd: workspaceFolder.uri.fsPath,
      environment: createExtensionHostNodeEnvironment(launcher.environment ?? process.env),
      forkProcess: launcher.forkProcess ?? fork,
      handleProcessError: launcher.handleProcessError,
    })
}

export interface LaunchLocalPrismaNextServerOptions {
  readonly entrypoint: string
  readonly cwd: string
  readonly environment: NodeJS.ProcessEnv
  readonly forkProcess: ForkLocalPrismaNextProcess
  readonly handleProcessError?: (error: Error) => void
}

export function launchLocalPrismaNextServer(options: LaunchLocalPrismaNextServerOptions): Promise<ChildProcessInfo> {
  return new Promise((resolve, reject) => {
    const child = options.forkProcess(options.entrypoint, ['lsp'], {
      cwd: options.cwd,
      env: options.environment,
      execArgv: [],
      silent: true,
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

function destroyProcessStreams(child: ChildProcess): void {
  child.stdin?.destroy()
  child.stdout?.destroy()
  child.stderr?.destroy()
}

export function createLocalPrismaNextClientOptions(
  workspaceFolder: WorkspaceFolder,
  middleware: LocalClientMiddleware,
): LanguageClientOptions {
  return {
    documentSelector: [{ language: 'prisma', scheme: 'file' }],
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
