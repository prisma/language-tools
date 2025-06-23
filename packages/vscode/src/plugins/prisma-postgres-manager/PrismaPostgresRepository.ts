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
import { waitForProcessKilled } from './utils/waitForProcessKilled'
import { proxySignals } from 'foreground-child/proxy-signals'
import { fork } from 'child_process'
import * as chokidar from 'chokidar'

const PPG_DEV_GLOBAL_ROOT = envPaths('prisma-dev')

export type RegionId = NonNullable<
  NonNullable<paths['/projects/{projectId}/databases']['post']['requestBody']>['content']['application/json']['region']
>
export type Region = {
  id: string
  name: string
  status: 'available' | 'unavailable' | 'unsupported'
}

export const WorkspaceSchema = z.object({
  type: z.literal('workspace'),
  id: z.string(),
  name: z.string(),
})
export type WorkspaceId = string
export type Workspace = z.infer<typeof WorkspaceSchema>
export function isWorkspace(item: unknown): item is Workspace {
  return WorkspaceSchema.safeParse(item).success
}

export const ProjectSchema = z.object({
  type: z.literal('project'),
  id: z.string(),
  name: z.string(),
  workspaceId: z.string(),
})
export type ProjectId = string
export type Project = z.infer<typeof ProjectSchema>
export function isProject(item: unknown): item is Project {
  return ProjectSchema.safeParse(item).success
}

export const RemoteDatabaseSchema = z.object({
  type: z.literal('remoteDatabase'),
  id: z.string(),
  name: z.string(),
  region: z.string().nullable(),
  projectId: z.string(),
  workspaceId: z.string(),
})
export type RemoteDatabaseId = string
export type RemoteDatabase = z.infer<typeof RemoteDatabaseSchema>
export function isRemoteDatabase(item: unknown): item is RemoteDatabase {
  return RemoteDatabaseSchema.safeParse(item).success
}

export const LocalDatabaseSchema = z.object({
  type: z.literal('localDatabase'),
  id: z.string(),
  name: z.string(),
  url: z.string().url(),
  pid: z.number(),
  running: z.boolean(),
})
export type LocalDatabase = z.infer<typeof LocalDatabaseSchema>
export function isLocalDatabase(item: unknown): item is LocalDatabase {
  return LocalDatabaseSchema.safeParse(item).success
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
  private localDatabasesCache: { timestamp: number; data: LocalDatabase[] } | undefined

  public readonly refreshEventEmitter = new EventEmitter<void | PrismaPostgresItem>()

  constructor(
    private readonly auth: Auth,
    private readonly connectionStringStorage: ConnectionStringStorage,
    private readonly context: ExtensionContext,
  ) {
    const watcher = chokidar.watch(PPG_DEV_GLOBAL_ROOT.data, {
      ignoreInitial: true,
    })

    watcher.on('addDir', () => this.refreshLocalDatabases())
    watcher.on('unlinkDir', () => this.refreshLocalDatabases())
    watcher.on('change', () => this.refreshLocalDatabases())

    context.subscriptions.push({ dispose: () => watcher.close() })
  }

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
    options,
  }: {
    workspaceId: string
    name: string
    region: string
    options: { skipRefresh?: boolean }
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

    if (options.skipRefresh !== true) {
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
    const response = await client.GET('/projects/{projectId}/databases', {
      params: {
        path: { projectId },
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
    options,
  }: {
    workspaceId: string
    projectId: string
    name: string
    region: string
    options: { skipRefresh?: boolean }
  }): Promise<NewRemoteDatabase> {
    this.ensureValidRegion(region)

    const client = await this.getClient(workspaceId)
    const response = await client.POST('/projects/{projectId}/databases', {
      params: {
        path: { projectId },
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

    if (options.skipRefresh !== true) {
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

  private refreshLocalDatabases() {
    this.refreshEventEmitter.fire()
  }

  async getLocalDatabase(args: { name: string }) {
    const { name } = args

    const databases = await this.getLocalDatabases()

    return databases.find((db) => db.name === name)
  }

  async getLocalDatabases(): Promise<LocalDatabase[]> {
    const now = Date.now()

    // we cache the local databases for 100ms to prevent overusage of filesystem
    if (this.localDatabasesCache && now - this.localDatabasesCache.timestamp < 100) {
      return this.localDatabasesCache.data
    }

    const { ServerState } = await import('@prisma/dev/internal/state')
    const data = (await ServerState.scan()).map((state) => {
      const { name, exports, status } = state
      const url = exports?.ppg.url ?? 'http://offline'
      let running = status === 'running' || status === 'starting_up'
      let pid = state.pid ?? -1

      // ppg dev quirk: after a deploy command, since it's run in the same
      // process as vscode, it stores the process pid and think it's running
      if (pid === process.pid) {
        pid = -1
        running = false
      }

      return { type: 'localDatabase', pid, name, id: name, url, running } as const
    })

    this.localDatabasesCache = { timestamp: now, data }

    return data
  }

  async createOrStartLocalDatabase(args: { name: string }): Promise<void> {
    const { name } = args

    // skip spawning a new server if we know the server is running
    const database = await this.getLocalDatabase({ name })
    if (database?.running === true) return

    // TODO: once ppg dev has a daemon, this should be replaced
    const { path } = Uri.joinPath(
      this.context.extensionUri,
      ...['dist', 'src', 'plugins', 'prisma-postgres-manager', 'utils', 'spawnPpgDevServer.js'],
    )

    const child = fork(path, [name], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'], detached: true })
    child.stdout?.on('data', (data) => console.log(`[PPG Child ${name}] ${String(data).trim()}`))
    child.stderr?.on('data', (data) => console.error(`[PPG Child ${name}] ${String(data).trim()}`))
    proxySignals(child) // closes the children if parent is closed (ie. vscode)

    await new Promise((resolve, reject) => {
      child.on('error', reject)

      child.stdout?.on('data', (data) => {
        if (String(data).includes('[PPG Dev] Server started')) {
          return resolve(undefined)
        }
      })

      child.stderr?.on('data', (data) => {
        if (String(data).includes('[PPG Dev] Error starting')) {
          return reject(new Error(`${data}`))
        }
      })
    })

    void this.refreshLocalDatabases()
  }

  async deleteLocalDatabase(args: { name: string }): Promise<void> {
    const { name } = args

    const database = await this.getLocalDatabase({ name })

    if (database !== undefined) {
      const databasePath = path.join(PPG_DEV_GLOBAL_ROOT.data, name)

      await this.stopLocalDatabase({ name }).catch(() => {})
      await fs.rm(databasePath, { recursive: true, force: true })
    }

    void this.refreshLocalDatabases()
  }

  async stopLocalDatabase(args: { name: string }): Promise<void> {
    const { name } = args

    const database = await this.getLocalDatabase({ name })

    if (database?.running) {
      const { pid } = database

      process.kill(pid, 'SIGTERM')
      await waitForProcessKilled(pid)
    }

    void this.refreshLocalDatabases()
  }

  async deployLocalDatabase(args: { name: string; url: string; projectId: string; workspaceId: string }) {
    const { Client } = await import('@prisma/ppg')
    const { ServerState } = await import('@prisma/dev/internal/state')
    const { dumpDB } = await import('@prisma/dev/internal/db')
    const { name, url, projectId, workspaceId } = args

    await this.stopLocalDatabase({ name }) // db has to be stopped before dumping

    const state = await ServerState.createExclusively({ name, persistenceMode: 'stateful' })

    try {
      const dump = await dumpDB({ dataDir: state.pgliteDataDirPath })
      await new Client({ connectionString: url }).query(dump, [])
    } catch (e) {
      await state.close()
      throw e
    }

    await state.close()

    void this.refreshProjects({ workspaceId })
    void this.refreshRemoteDatabases({ projectId, workspaceId })
  }

  async getLocalDatabaseConnectionString(args: { name: string }) {
    const { name } = args

    const database = await this.getLocalDatabase({ name })

    if (database?.running !== true) {
      void this.refreshLocalDatabases()
      throw new Error('This database has been deleted or stopped')
    }

    return database.url
  }
}
