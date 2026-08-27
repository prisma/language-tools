import path from 'node:path'
import { stat } from 'node:fs/promises'
import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from 'node:child_process'
import { workspace, type Disposable, type TextDocument, type WorkspaceFolder } from 'vscode'
import { CloseAction, ErrorAction, type LanguageClientOptions } from 'vscode-languageclient'
import { LanguageClient, type ChildProcessInfo, type ServerOptions } from 'vscode-languageclient/node'

const prismaCliRelativePath = ['node_modules', 'prisma', 'dist', 'prisma.js'] as const

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

/**
 * Starts and tracks one Prisma Next language server (`prisma lsp`) per workspace folder.
 *
 * Both the legacy and the Prisma Next server receive every open `.prisma` document and decide
 * from the `// use prisma-next` directive in the document content whether to respond, so no
 * per-document routing happens here: once a folder's client is running it synchronizes all
 * Prisma documents under that folder.
 */
export class PrismaNextClients {
  private readonly clients = new Map<string, Promise<LanguageClient | undefined>>()
  private disposed = false

  constructor(private readonly registerDisposable: (disposable: Disposable) => void) {}

  /** Starts a client for the document's workspace folder unless one is already running. */
  ensureClientFor(document: TextDocument): void {
    if (this.disposed || !workspace.isTrusted || document.uri.scheme !== 'file') return

    const workspaceFolder = workspace.getWorkspaceFolder(document.uri)
    if (workspaceFolder?.uri.scheme !== 'file') return

    const key = workspaceFolder.uri.toString()
    if (this.clients.has(key)) return

    const pending = this.start(workspaceFolder)
    this.clients.set(key, pending)
    // Forget failed startups so a later edit (e.g. after `npm install`) retries.
    void pending.then((client) => {
      if (!client && this.clients.get(key) === pending) {
        this.clients.delete(key)
      }
    })
  }

  /** Stops all clients. The registry stays usable; new clients can be started afterwards. */
  async stopAll(): Promise<void> {
    const pending = [...this.clients.values()]
    this.clients.clear()
    await Promise.allSettled(pending.map(async (client) => (await client)?.stop()))
  }

  async dispose(): Promise<void> {
    this.disposed = true
    await this.stopAll()
  }

  private async start(workspaceFolder: WorkspaceFolder): Promise<LanguageClient | undefined> {
    const entrypoint = getPrismaNextEntrypoint(workspaceFolder)
    let client: LanguageClient | undefined
    try {
      if (!(await isFile(entrypoint)) || this.disposed) return undefined

      client = new LanguageClient(
        `prisma-next:${workspaceFolder.uri.toString()}`,
        `Prisma Next Language Server (${workspaceFolder.name})`,
        createPrismaNextServerOptions(workspaceFolder, entrypoint, {
          handleProcessError: (error) => this.handleError(workspaceFolder, error),
        }),
        createPrismaNextClientOptions(workspaceFolder),
      )
      this.registerDisposable(client.start())
      await client.onReady()
      if (this.disposed) {
        await client.stop()
        return undefined
      }
      return client
    } catch (error) {
      if (client) {
        try {
          await client.stop()
        } catch {
          // The failed startup already tore the client down.
        }
      }
      if (!this.disposed) this.handleError(workspaceFolder, error)
      return undefined
    }
  }

  private handleError(workspaceFolder: WorkspaceFolder, error: unknown): void {
    console.error(`Prisma Next Language Server failed for ${workspaceFolder.uri.toString()}`, error)
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

export function createPrismaNextClientOptions(workspaceFolder: WorkspaceFolder): LanguageClientOptions {
  const rootPath = workspaceFolder.uri.fsPath.split('\\').join('/')
  const normalizedRoot = rootPath.endsWith('/') ? rootPath.slice(0, -1) : rootPath
  const escapedRoot = normalizedRoot.replace(/([?*[\]])/g, '[$1]')
  return {
    documentSelector: [{ language: 'prisma', scheme: 'file', pattern: `${escapedRoot}/**/*` }],
    workspaceFolder,
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
