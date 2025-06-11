import { EventEmitter, ExtensionContext, Uri } from 'vscode'
import { createManagementAPIClient } from './management-api/client'
import { CredentialsStore } from '@prisma/credentials-store'
import type { ConnectionStringStorage } from './ConnectionStringStorage'
import { Auth } from './management-api/auth'
import type { paths } from './management-api/api.d'
import { z } from 'zod'
import envPaths from 'env-paths'
import * as fs from 'fs/promises'
import * as path from 'path'
import { waitForPortBorrowed } from './utils/waitForPortBorrowed'
import { waitForPortAvailable } from './utils/waitForPortAvailable'
import { getUniquePorts } from './utils/getUniquePorts'
import { isPidRunning } from './utils/isPidRunning'
import { proxySignals } from 'foreground-child/proxy-signals'
import { fork } from 'child_process'

const PPG_DEV_GLOBAL_ROOT = envPaths('prisma-dev')

export type RegionId = NonNullable<
  NonNullable<paths['/projects/{id}/databases']['post']['requestBody']>['content']['application/json']['region']
>
export type Region = {
  id: string
  name: string
  status: 'available' | 'unavailable' | 'unsupported'
}

export type WorkspaceId = string
export type Workspace = {
  type: 'workspace'
  id: WorkspaceId
  name: string
}
export function isWorkspace(item: unknown): item is Workspace {
  return typeof item === 'object' && item !== null && 'type' in item && item.type === 'workspace'
}

export type ProjectId = string
export type Project = {
  type: 'project'
  id: ProjectId
  name: string
  workspaceId: WorkspaceId
}
export function isProject(item: unknown): item is Project {
  return typeof item === 'object' && item !== null && 'type' in item && item.type === 'project'
}

export type RemoteDatabaseId = string
export type RemoteDatabase = {
  type: 'remoteDatabase'
  id: RemoteDatabaseId
  name: string
  region: string | null
  projectId: ProjectId
  workspaceId: WorkspaceId
}
export function isRemoteDatabase(item: unknown): item is RemoteDatabase {
  return typeof item === 'object' && item !== null && 'type' in item && item.type === 'remoteDatabase'
}

export type LocalDatabase = {
  type: 'localDatabase'
  id: string
  name: string
  url: string
  pid: number
  running: boolean
}
export function isLocalDatabase(item: unknown): item is LocalDatabase {
  return typeof item === 'object' && item !== null && 'type' in item && item.type === 'localDatabase'
}

export type NewRemoteDatabase = RemoteDatabase & { connectionString: string }

export type PrismaPostgresItem =
  | { type: 'localRoot' }
  | { type: 'remoteRoot' }
  | Workspace
  | Project
  | RemoteDatabase
  | LocalDatabase

export class PrismaPostgresRepository {
  private clients: Map<string, ReturnType<typeof createManagementAPIClient>> = new Map()
  private credentialsStore = new CredentialsStore()

  private regionsCache: Region[] = []
  private workspacesCache = new Map<WorkspaceId, Workspace>()
  private projectsCache = new Map<WorkspaceId, Map<ProjectId, Project>>()
  private remoteDatabasesCache = new Map<string, Map<RemoteDatabaseId, RemoteDatabase>>()

  public readonly refreshEventEmitter = new EventEmitter<void | PrismaPostgresItem>()

  constructor(
    private readonly auth: Auth,
    private readonly connectionStringStorage: ConnectionStringStorage,
    private readonly context: ExtensionContext,
  ) {}

  private async getClient(workspaceId: string) {
    if (!this.clients.has(workspaceId)) {
      await this.credentialsStore.reloadCredentialsFromDisk()
      const credentials = await this.credentialsStore.getCredentialsForWorkspace(workspaceId)
      if (!credentials) throw new Error(`Workspace '${workspaceId}' not found`)

      const refreshTokenHandler = async () => {
        const credentials = await this.credentialsStore.getCredentialsForWorkspace(workspaceId)
        if (!credentials) throw new Error(`Workspace '${workspaceId}' not found`)
        const { token, refreshToken } = await this.auth.refreshToken(credentials.refreshToken)
        await this.credentialsStore.storeCredentials({ ...credentials, token, refreshToken })
        return { token }
      }

      const client = createManagementAPIClient(credentials.token, refreshTokenHandler)

      this.clients.set(workspaceId, client)
    }
    return this.clients.get(workspaceId)!
  }

  private checkResponseOrThrow<T, E>(
    workspaceId: string,
    response: {
      error?: E
      data?: T
      response: Response
    },
  ): asserts response is { error: never; data: T; response: Response } {
    console.log('Received response', { error: response.error, statusCode: response.response.status })

    if (response.response.status < 400 && !response.error) return

    if (response.response.status === 401) {
      void this.removeWorkspace({ workspaceId })
      throw new Error(`Session expired. Please sign in to continue.`)
    }

    const error = z
      .object({
        message: z.string().optional(),
        errorDescription: z.string().optional(),
        error: z
          .object({
            message: z.string().optional(),
          })
          .optional(),
      })
      .safeParse(response.error)

    const errorMessage = error.data?.message || error.data?.error?.message || error.data?.errorDescription
    if (!errorMessage) throw new Error(`Unknown API error occurred. Status Code: ${response.response.status}.`)
    throw new Error(errorMessage)
  }

  triggerRefresh() {
    void this.credentialsStore.reloadCredentialsFromDisk()
    // Wipe caches
    this.regionsCache = []
    this.workspacesCache = new Map()
    this.projectsCache = new Map()
    this.remoteDatabasesCache = new Map()
    // Trigger full tree view refresh which will fetch fresh data on demand due to cache misses
    this.refreshEventEmitter.fire()
  }

  async getRegions(): Promise<Region[]> {
    if (this.regionsCache.length > 0) return this.regionsCache

    const workspaceId = (await this.getWorkspaces()).at(0)?.id
    if (!workspaceId) return []

    const client = await this.getClient(workspaceId)
    const response = await client.GET('/regions')
    this.checkResponseOrThrow(workspaceId, response)

    this.regionsCache = response.data.data

    return this.regionsCache
  }

  private ensureValidRegion(value: string): asserts value is RegionId {
    // This is not super precise but at the point this validation is called, the
    // regions are already in the cache.
    // Async type asserting function do not exist in typescript and we anyways have
    // a potential runtime mismatch between the actually available regions and the
    // regions known to the type system.
    if (!this.regionsCache.some((r) => r.id === value)) {
      throw new Error(`Invalid region: ${value}. Available regions: ${this.regionsCache.map((r) => r.id).join(', ')}.`)
    }
  }

  async getWorkspaces(): Promise<Workspace[]> {
    if (this.workspacesCache.size > 0) return Array.from(this.workspacesCache.values())

    const credentials = await this.credentialsStore.getCredentials()
    const results = await Promise.allSettled(
      credentials.map(async (cred) => {
        const client = await this.getClient(cred.workspaceId)
        const response = await client.GET('/workspaces')
        this.checkResponseOrThrow(cred.workspaceId, response)
        const workspaceInfo = response.data.data.at(0)
        if (!workspaceInfo) throw new Error(`Workspaces endpoint returned no workspace info.`)

        const workspace: Workspace = {
          type: 'workspace',
          id: workspaceInfo.id,
          name: workspaceInfo.displayName,
        }
        this.workspacesCache.set(workspace.id, workspace)
        return workspace
      }),
    )
    return results
      .flatMap((r) => {
        if (r.status === 'fulfilled') {
          return [r.value]
        } else {
          console.error(`Failed to get workspace info`, r.reason)
          return []
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  async addWorkspace({ token, refreshToken }: { token: string; refreshToken: string }): Promise<void> {
    const client = createManagementAPIClient(token, () => {
      throw new Error('Received token has to be instantly refreshed. Something is wrong.')
    })
    const response = await client.GET('/workspaces')

    if (response.error) throw new Error(`Failed to retrieve workspace information.`)

    const workspaces = response.data.data

    if (workspaces.length === 0) throw new Error(`Received token does not grant access to any workspaces.`)

    await Promise.all(
      workspaces.map(async ({ id, displayName }) => {
        await this.credentialsStore.storeCredentials({
          workspaceId: id,
          token,
          refreshToken,
        })
        this.workspacesCache.set(id, {
          type: 'workspace',
          id,
          name: displayName,
        })
      }),
    )

    this.refreshEventEmitter.fire()
  }

  async removeWorkspace({ workspaceId }: { workspaceId: string }): Promise<void> {
    this.clients.delete(workspaceId)
    await this.connectionStringStorage.removeConnectionString({ workspaceId })
    this.workspacesCache.delete(workspaceId)
    await this.credentialsStore.deleteCredentials(workspaceId)
    this.refreshEventEmitter.fire()
    return Promise.resolve()
  }

  async getProjects(
    { workspaceId }: { workspaceId: string },
    { forceCacheRefresh }: { forceCacheRefresh: boolean } = { forceCacheRefresh: false },
  ): Promise<Project[]> {
    if (!forceCacheRefresh) {
      const cachedProjects = this.projectsCache.get(workspaceId)
      if (cachedProjects !== undefined) return Array.from(cachedProjects.values())
    }

    const client = await this.getClient(workspaceId)
    const response = await client.GET('/projects')

    this.checkResponseOrThrow(workspaceId, response)

    const projects: Map<string, Project> = new Map(
      response.data.data.map((project) => [
        project.id,
        {
          type: 'project' as const,
          id: project.id,
          name: project.name,
          workspaceId,
        },
      ]),
    )

    this.projectsCache.set(workspaceId, projects)

    return Array.from(projects.values())
  }

  async createProject({
    workspaceId,
    name,
    region,
    skipRefresh,
  }: {
    workspaceId: string
    name: string
    region: string
    skipRefresh?: boolean
  }): Promise<{ project: Project; database?: NewRemoteDatabase }> {
    this.ensureValidRegion(region)

    const client = await this.getClient(workspaceId)
    const response = await client.POST('/projects', {
      body: {
        name,
        region,
      },
    })

    this.checkResponseOrThrow(workspaceId, response)

    const newProject = {
      type: 'project' as const,
      id: response.data.id,
      name: response.data.name,
      workspaceId,
    }

    let createdDatabase: RemoteDatabase | undefined
    let connectionString: string | undefined
    if ('databases' in response.data) {
      const createdDatabaseData = response.data.databases[0]
      if (createdDatabaseData) {
        createdDatabase = {
          type: 'remoteDatabase' as const,
          id: createdDatabaseData.id,
          name: createdDatabaseData.name,
          region: createdDatabaseData.region,
          projectId: newProject.id,
          workspaceId,
        }
        connectionString = createdDatabaseData.connectionString

        await this.connectionStringStorage.storeConnectionString({
          workspaceId,
          projectId: newProject.id,
          databaseId: createdDatabase.id,
          connectionString,
        })
      }
    }

    if (skipRefresh !== true) {
      // Proactively update cache
      this.projectsCache.get(workspaceId)?.set(newProject.id, newProject)
      this.remoteDatabasesCache.set(
        `${workspaceId}.${newProject.id}`,
        new Map(createdDatabase ? [[createdDatabase.id, createdDatabase]] : []),
      )

      // Update in the background
      this.refreshEventEmitter.fire()
      void this.refreshProjects({ workspaceId })
    }

    if (createdDatabase && connectionString) {
      return { project: newProject, database: { ...createdDatabase, connectionString } }
    } else {
      return { project: newProject }
    }
  }

  async deleteProject({ workspaceId, id }: { workspaceId: string; id: string } | Project): Promise<void> {
    const client = await this.getClient(workspaceId)
    const response = await client.DELETE('/projects/{id}', {
      params: {
        path: { id },
      },
    })

    this.checkResponseOrThrow(workspaceId, response)

    await this.connectionStringStorage.removeConnectionString({
      workspaceId,
      projectId: id,
    })

    // Proactively update cache
    this.projectsCache.get(workspaceId)?.delete(id)
    this.refreshEventEmitter.fire()
    // And then refresh list from server in background
    void this.refreshProjects({ workspaceId })
  }

  private async refreshProjects({ workspaceId }: { workspaceId: string }) {
    await this.getProjects({ workspaceId }, { forceCacheRefresh: true }).then(() => this.refreshEventEmitter.fire())
  }

  async getRemoteDatabases(
    {
      workspaceId,
      projectId,
    }: {
      workspaceId: string
      projectId: string
    },
    { forceCacheRefresh }: { forceCacheRefresh: boolean } = { forceCacheRefresh: false },
  ): Promise<RemoteDatabase[]> {
    if (!forceCacheRefresh) {
      const cachedDatabases = this.remoteDatabasesCache.get(`${workspaceId}.${projectId}`)
      if (cachedDatabases !== undefined) return Array.from(cachedDatabases.values())
    }

    const client = await this.getClient(workspaceId)
    const response = await client.GET('/projects/{id}/databases', {
      params: {
        path: { id: projectId },
      },
    })

    this.checkResponseOrThrow(workspaceId, response)

    const databases: Map<string, RemoteDatabase> = new Map(
      response.data.data.map((db) => [
        db.id,
        {
          type: 'remoteDatabase' as const,
          id: db.id,
          name: db.name,
          region: db.region,
          projectId,
          workspaceId,
        },
      ]),
    )

    this.remoteDatabasesCache.set(`${workspaceId}.${projectId}`, databases)

    return Array.from(databases.values())
  }

  async getStoredRemoteDatabaseConnectionString({
    workspaceId,
    projectId,
    databaseId,
  }: {
    workspaceId: string
    projectId: string
    databaseId: string
  }): Promise<string | undefined> {
    return this.connectionStringStorage.getConnectionString({ workspaceId, projectId, databaseId })
  }

  async createRemoteDatabaseConnectionString({
    workspaceId,
    projectId,
    databaseId,
  }: {
    workspaceId: string
    projectId: string
    databaseId: string
  }): Promise<string> {
    const client = await this.getClient(workspaceId)
    const response = await client.POST('/projects/{projectId}/databases/{databaseId}/connections', {
      params: {
        path: { projectId, databaseId },
      },
      body: {
        name: "Created by Prisma's VSCode Extension",
      },
    })

    this.checkResponseOrThrow(workspaceId, response)

    const connectionString = response.data.connectionString
    await this.connectionStringStorage.storeConnectionString({
      workspaceId,
      projectId,
      databaseId,
      connectionString,
    })
    return connectionString
  }

  async createRemoteDatabase({
    workspaceId,
    projectId,
    name,
    region,
    skipRefresh,
  }: {
    workspaceId: string
    projectId: string
    name: string
    region: string
    skipRefresh?: boolean
  }): Promise<NewRemoteDatabase> {
    this.ensureValidRegion(region)

    const client = await this.getClient(workspaceId)
    const response = await client.POST('/projects/{id}/databases', {
      params: {
        path: { id: projectId },
      },
      body: {
        name,
        region,
      },
    })

    this.checkResponseOrThrow(workspaceId, response)

    const newDatabase = {
      type: 'remoteDatabase' as const,
      id: response.data.id,
      name: response.data.name,
      region: response.data.region,
      projectId,
      workspaceId,
    }
    const connectionString = response.data.connectionString

    if (skipRefresh !== true) {
      // Proactively update cache
      this.remoteDatabasesCache.get(workspaceId)?.set(newDatabase.id, newDatabase)

      // Update in the background
      this.refreshEventEmitter.fire()
      void this.refreshRemoteDatabases({ workspaceId, projectId })
    }

    await this.connectionStringStorage.storeConnectionString({
      workspaceId,
      projectId,
      databaseId: newDatabase.id,
      connectionString,
    })

    return { ...newDatabase, connectionString }
  }

  async deleteRemoteDatabase({
    workspaceId,
    projectId,
    id,
  }:
    | {
        workspaceId: string
        projectId: string
        id: string
      }
    | RemoteDatabase): Promise<void> {
    const client = await this.getClient(workspaceId)
    const response = await client.DELETE('/projects/{projectId}/databases/{databaseId}', {
      params: {
        path: {
          projectId,
          databaseId: id,
        },
      },
    })

    this.checkResponseOrThrow(workspaceId, response)

    await this.connectionStringStorage.removeConnectionString({
      workspaceId,
      projectId,
      databaseId: id,
    })

    // Proactively update cache
    this.remoteDatabasesCache.get(`${workspaceId}.${projectId}`)?.delete(id)
    this.refreshEventEmitter.fire()
    // And then refresh list from server in background
    void this.refreshRemoteDatabases({ workspaceId, projectId })
  }

  private async refreshRemoteDatabases({ workspaceId, projectId }: { workspaceId: string; projectId: string }) {
    await this.getRemoteDatabases({ workspaceId, projectId }, { forceCacheRefresh: true }).then(() =>
      this.refreshEventEmitter.fire(),
    )
  }

  private async refreshLocalDatabases() {
    this.refreshEventEmitter.fire()
  }

  async getLocalDatabases(): Promise<LocalDatabase[]> {
    const { ServerState } = await import('@prisma/dev/internal/state')
    
    return (await ServerState.scan()).map((state) => {
      const { name, exports, status } = state
      const running = status === 'running'
      const url = exports?.ppg.url ?? 'http://offline'
      const pid = state.pid ?? -1

      return { type: 'localDatabase', pid, name, id: name, url, running } as const
    })
  }

  async createLocalDatabase(args: { name: string }): Promise<void> {
    // TODO: once ppg dev has a daemon, this should be replaced
    const { name } = args
    const [port, databasePort, shadowDatabasePort] = (await getUniquePorts(3)).map(String)
    const { path: ppgDevServerPath } = Uri.joinPath(
      this.context.extensionUri,
      ...['dist', 'src', 'plugins', 'prisma-postgres-manager', 'utils', 'spawnPpgDevServer.js'],
    )

    const child = fork(ppgDevServerPath, [name, port, databasePort, shadowDatabasePort], {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      detached: true,
    })

    child.on('error', (error) => console.error(`[PPG Dev] Process (${name}) error for database:`, error))
    child.on('exit', (code, signal) => console.log(`[PPG Dev] Process (${name}) exited (${code}, ${signal})`))
    child.on('spawn', () => console.log(`[PPG Dev] Process (${name}) spawned successfully`))
    child.stdout?.on('data', (data) => console.log(`[PPG Child ${name}] ${data.toString().trim()}`))
    child.stderr?.on('data', (data) => console.error(`[PPG Child ${name}] ${data.toString().trim()}`))

    proxySignals(child) // closes the children if parent is closed (ie. vscode)

    await waitForPortBorrowed(+port)

    void this.refreshLocalDatabases()
  }

  async startLocalDatabase(args: { pid: number; name: string }): Promise<void> {
    const { pid, name } = args

    if (isPidRunning(pid) === false || pid === process.pid) {
      console.log(`[startLocalDatabase] starting local database ${name}`)
      await this.createLocalDatabase(args)
    } else {
      console.log(`[startLocalDatabase] local database ${name} already started`)
    }
  }

  async deleteLocalDatabase(args: { pid: number; name: string; url: string }): Promise<void> {
    const { pid, name, url } = args
    const databasePath = path.join(PPG_DEV_GLOBAL_ROOT.data, name)

    try {
      await this.stopLocalDatabase({ pid, url }).catch(() => {})
      await fs.rm(databasePath, { recursive: true, force: true })
      console.log(`[deleteLocalDatabase] Deleted local database folder: ${databasePath}`)
    } catch (error) {
      console.error(`[deleteLocalDatabase] Failed to delete local database folder: ${databasePath}`, error)
    }

    void this.refreshLocalDatabases()
  }

  async stopLocalDatabase(args: { pid: number; url: string }): Promise<void> {
    const { pid, url } = args
    const { port } = new URL(url)

    process.kill(pid, 'SIGTERM')
    await waitForPortAvailable(+port)

    void this.refreshLocalDatabases()
  }

  async deployLocalDatabase(args: { name: string; url: string; projectId: string; workspaceId: string }) {
    const { Client } = await import('@prisma/ppg')
    const { ServerState } = await import("@prisma/dev/internal/state")
    const { dumpDB } = await import("@prisma/dev/internal/db")
    const { name, url, projectId, workspaceId } = args

    const state = await ServerState.createExclusively({ name, persistenceMode: 'stateful' })

    try {
      let dump = await dumpDB({ dataDir: state.pgliteDataDirPath })
      await new Client({ connectionString: url }).query(dump, [])
    } catch (e) {
      await state.close()
      throw e
    }

    await state.close()

    void this.refreshProjects({ workspaceId })
    void this.refreshRemoteDatabases({ projectId, workspaceId })
  }
}
