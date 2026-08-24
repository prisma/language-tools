import path from 'node:path'
import { stat } from 'node:fs/promises'
import type { Disposable, TextDocument, Uri, WorkspaceFolder } from 'vscode'
import type { LanguageClientOptions } from 'vscode-languageclient'
import { TransportKind, type LanguageClient, type ServerOptions } from 'vscode-languageclient/node'

const prismaCliRelativePath = ['node_modules', 'prisma', 'dist', 'prisma.js'] as const

export const localPrismaNextClientTestStateCommand = 'prisma.test.localPrismaNextClientState'

export interface LocalPrismaNextClientRegistryWorkspace {
  readonly isTrusted: boolean
  getWorkspaceFolder(uri: Uri): WorkspaceFolder | undefined
}

export interface LocalPrismaNextClientRegistryOptions {
  readonly workspace: LocalPrismaNextClientRegistryWorkspace
  readonly createClient: (
    id: string,
    name: string,
    serverOptions: ServerOptions,
    clientOptions: LanguageClientOptions,
  ) => LanguageClient
  readonly registerDisposable: (disposable: Disposable) => void
  readonly entrypointExists?: (entrypoint: string) => Promise<boolean>
  readonly handleStartError?: (workspaceFolder: WorkspaceFolder, error: unknown) => void
}

export interface LocalPrismaNextClientTestState {
  readonly startedWorkspaceFolderUris: readonly string[]
}

export class LocalPrismaNextClientRegistry {
  private readonly clients = new Map<string, Promise<LanguageClient | undefined>>()
  private readonly startedClients = new Map<string, LanguageClient>()

  constructor(private readonly options: LocalPrismaNextClientRegistryOptions) {}

  ensureClientForDocument(document: TextDocument): Promise<LanguageClient | undefined> {
    if (!this.options.workspace.isTrusted || document.uri.scheme !== 'file') {
      return Promise.resolve(undefined)
    }

    const workspaceFolder = this.options.workspace.getWorkspaceFolder(document.uri)
    if (!workspaceFolder || workspaceFolder.uri.scheme !== 'file') {
      return Promise.resolve(undefined)
    }

    return this.ensureClient(workspaceFolder)
  }

  getTestState(): LocalPrismaNextClientTestState {
    return {
      startedWorkspaceFolderUris: [...this.startedClients.keys()].sort(),
    }
  }

  private ensureClient(workspaceFolder: WorkspaceFolder): Promise<LanguageClient | undefined> {
    const workspaceFolderUri = workspaceFolder.uri.toString()
    const existing = this.clients.get(workspaceFolderUri)
    if (existing) {
      return existing
    }

    const pending = Promise.resolve().then(() => this.discoverAndStart(workspaceFolder))
    this.clients.set(workspaceFolderUri, pending)
    return pending
  }

  private async discoverAndStart(workspaceFolder: WorkspaceFolder): Promise<LanguageClient | undefined> {
    const entrypoint = getLocalPrismaNextEntrypoint(workspaceFolder)

    try {
      const exists = await (this.options.entrypointExists ?? isFile)(entrypoint)
      if (!exists) {
        return undefined
      }

      const workspaceFolderUri = workspaceFolder.uri.toString()
      const client = this.options.createClient(
        `prisma-next:${workspaceFolderUri}`,
        `Prisma Next Language Server (${workspaceFolder.name})`,
        createLocalPrismaNextServerOptions(workspaceFolder, entrypoint),
        createLocalPrismaNextClientOptions(workspaceFolder),
      )
      this.options.registerDisposable(client.start())
      await client.onReady()
      this.startedClients.set(workspaceFolderUri, client)
      return client
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
): ServerOptions {
  return {
    module: entrypoint,
    args: ['lsp'],
    transport: TransportKind.stdio,
    // No runtime is specified: vscode-languageclient forks the module with the extension-host Node runtime.
    options: { cwd: workspaceFolder.uri.fsPath },
  }
}

export function createLocalPrismaNextClientOptions(workspaceFolder: WorkspaceFolder): LanguageClientOptions {
  return {
    // Synchronization stays disabled until owner-filtered local middleware is attached.
    documentSelector: [],
    workspaceFolder,
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
