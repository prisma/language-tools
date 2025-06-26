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

// Simple cache manager to handle all caching logic
class CacheManager {
  private regions: Region[] = []
  private workspaces = new Map<WorkspaceId, Workspace>()
  private projects = new Map<string, Map<ProjectId, Project>>()
  private databases = new Map<string, Map<RemoteDatabaseId, RemoteDatabase>>()
  private localDatabases: { timestamp: number; data: LocalDatabase[] } | undefined

  generateKey(workspaceId: string, projectId?: string): string {
    return projectId ? `${workspaceId}.${projectId}` : workspaceId
  }

  // Workspace cache
  setWorkspaces(workspaces: Workspace[]): void {
    this.workspaces.clear()
    workspaces.forEach((w) => this.workspaces.set(w.id, w))
  }

  getWorkspaces(): Workspace[] {
    return Array.from(this.workspaces.values())
  }

  hasWorkspaces(): boolean {
    return this.workspaces.size > 0
  }

  removeWorkspace(workspaceId: string): void {
    this.workspaces.delete(workspaceId)
    this.projects.delete(workspaceId)
    // Remove all databases for this workspace
    Array.from(this.databases.keys())
      .filter((key) => key.startsWith(`${workspaceId}.`))
      .forEach((key) => this.databases.delete(key))
  }

  // Project cache
  setProjects(workspaceId: string, projects: Project[]): void {
    const projectMap = new Map<ProjectId, Project>()
    projects.forEach((p) => projectMap.set(p.id, p))
    this.projects.set(workspaceId, projectMap)
  }

  getProjects(workspaceId: string): Project[] {
    return Array.from(this.projects.get(workspaceId)?.values() || [])
  }

  hasProjects(workspaceId: string): boolean {
    return this.projects.has(workspaceId)
  }

  addProject(project: Project): void {
    if (!this.projects.has(project.workspaceId)) {
      this.projects.set(project.workspaceId, new Map())
    }
    this.projects.get(project.workspaceId)!.set(project.id, project)
  }

  removeProject(workspaceId: string, projectId: string): void {
    this.projects.get(workspaceId)?.delete(projectId)
    this.databases.delete(this.generateKey(workspaceId, projectId))
  }

  // Database cache
  setDatabases(workspaceId: string, projectId: string, databases: RemoteDatabase[]): void {
    const databaseMap = new Map<RemoteDatabaseId, RemoteDatabase>()
    databases.forEach((db) => databaseMap.set(db.id, db))
    this.databases.set(this.generateKey(workspaceId, projectId), databaseMap)
  }

  getDatabases(workspaceId: string, projectId: string): RemoteDatabase[] {
    return Array.from(this.databases.get(this.generateKey(workspaceId, projectId))?.values() || [])
  }

  hasDatabases(workspaceId: string, projectId: string): boolean {
    return this.databases.has(this.generateKey(workspaceId, projectId))
  }

  addDatabase(database: RemoteDatabase): void {
    const key = this.generateKey(database.workspaceId, database.projectId)
    if (!this.databases.has(key)) {
      this.databases.set(key, new Map())
    }
    this.databases.get(key)!.set(database.id, database)
  }

  removeDatabase(workspaceId: string, projectId: string, databaseId: string): void {
    this.databases.get(this.generateKey(workspaceId, projectId))?.delete(databaseId)
  }

  clearDatabases(workspaceId: string, projectId: string): void {
    this.databases.delete(this.generateKey(workspaceId, projectId))
  }

  // Region cache
  setRegions(regions: Region[]): void {
    this.regions = regions
  }

  getRegions(): Region[] {
    return this.regions
  }

  hasRegions(): boolean {
    return this.regions.length > 0
  }

  // Local database cache
  setLocalDatabases(databases: LocalDatabase[]): void {
    this.localDatabases = { timestamp: Date.now(), data: databases }
  }

  getLocalDatabases(): LocalDatabase[] | undefined {
    const now = Date.now()
    if (this.localDatabases && now - this.localDatabases.timestamp < 100) {
      return this.localDatabases.data
    }
    return undefined
  }

  clearAll(): void {
    this.workspaces.clear()
    this.projects.clear()
    this.databases.clear()
    this.regions = []
    this.localDatabases = undefined
  }
}

export class PrismaPostgresRepository {
  private isPreloading = false
  private preloadPromise: Promise<void> | null = null
  private clients = new Map<string, ReturnType<typeof createManagementAPIClient>>()
  private credentialsStore = new CredentialsStore()
  private cache = new CacheManager()

  public readonly refreshEventEmitter = new EventEmitter<void | PrismaPostgresItem>()

  constructor(
    private readonly auth: Auth,
    private readonly connectionStringStorage: ConnectionStringStorage,
    private readonly context: ExtensionContext,
  ) {
    const watcher = chokidar.watch(PPG_DEV_GLOBAL_ROOT.data, {
      ignoreInitial: true,
    })

    watcher.on('addDir', () => this.refreshEventEmitter.fire())
    watcher.on('unlinkDir', () => this.refreshEventEmitter.fire())
    watcher.on('change', () => this.refreshEventEmitter.fire())

    context.subscriptions.push({ dispose: () => watcher.close() })

    // Start preloading data in the background for better UX
    this.preloadPromise = this.preloadAllData()
  }

  private async waitForPreload(): Promise<void> {
    // Don't wait for preload if we're currently in the preloading process
    if (this.isPreloading || !this.preloadPromise) {
      return
    }

    try {
      await this.preloadPromise
    } catch (error) {
      // If preloading failed, we'll just proceed without it
      console.warn('Preloading failed, proceeding with direct fetch:', error)
    }
  }

  private async preloadAllData(): Promise<void> {
    try {
      this.isPreloading = true

      // Load workspaces first
      const workspaces = await this.getWorkspaces()

      // Load projects for all workspaces in parallel
      const projectPromises = workspaces.map(async (workspace) => {
        const projects = await this.getProjects({ workspaceId: workspace.id })

        // Load databases for all projects in parallel
        const databasePromises = projects.map((project) =>
          this.getRemoteDatabases({ workspaceId: workspace.id, projectId: project.id }),
        )

        // Wait for all databases to load (but don't block other workspaces)
        await Promise.allSettled(databasePromises)
        return projects
      })

      // Wait for all workspaces to finish loading their projects and databases
      await Promise.allSettled(projectPromises)
    } catch (error) {
      console.error('Error preloading data:', error)
      // Don't throw - preloading is optional for UX, shouldn't break functionality
    } finally {
      this.isPreloading = false
    }
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
    response: { error?: E; data?: T; response: Response },
  ): asserts response is { error: never; data: T; response: Response } {
    console.log('Received response', { error: response.error, statusCode: response.response.status })

    if (response.response.status < 400 && !response.error) return

    if (response.response.status === 401) {
      void this.removeWorkspace({ workspaceId })
      throw new Error(`Session expired. Please sign in to continue.`)
    }

    const errorMessage = this.extractErrorMessage(response.error)
    if (!errorMessage) {
      throw new Error(`Unknown API error occurred. Status Code: ${response.response.status}.`)
    }
    throw new Error(errorMessage)
  }

  private extractErrorMessage(error: unknown): string | undefined {
    const parsed = z
      .object({
        message: z.string().optional(),
        errorDescription: z.string().optional(),
        error: z.object({ message: z.string().optional() }).optional(),
      })
      .safeParse(error)

    return parsed.data?.message || parsed.data?.error?.message || parsed.data?.errorDescription
  }

  triggerRefresh(): void {
    void this.credentialsStore.reloadCredentialsFromDisk()
    this.cache.clearAll()
    this.preloadPromise = this.preloadAllData()
    this.refreshEventEmitter.fire()
  }

  async getRegions(): Promise<Region[]> {
    await this.waitForPreload()

    if (this.cache.hasRegions()) {
      return this.cache.getRegions()
    }

    const workspaces = await this.getWorkspaces()
    const workspaceId = workspaces[0]?.id
    if (!workspaceId) return []

    const client = await this.getClient(workspaceId)
    const response = await client.GET('/regions')
    this.checkResponseOrThrow(workspaceId, response)

    const regions = response.data.data
    this.cache.setRegions(regions)
    return regions
  }

  private ensureValidRegion(value: string): asserts value is RegionId {
    const regions = this.cache.getRegions()
    if (!regions.some((r) => r.id === value)) {
      throw new Error(`Invalid region: ${value}. Available regions: ${regions.map((r) => r.id).join(', ')}.`)
    }
  }

  async getWorkspaces(): Promise<Workspace[]> {
    await this.waitForPreload()

    if (this.cache.hasWorkspaces()) {
      return this.cache.getWorkspaces()
    }

    const credentials = await this.credentialsStore.getCredentials()
    const results = await Promise.allSettled(
      credentials.map(async (cred) => {
        const client = await this.getClient(cred.workspaceId)
        const response = await client.GET('/workspaces')
        this.checkResponseOrThrow(cred.workspaceId, response)

        const workspaceInfo = response.data.data.at(0)
        if (!workspaceInfo) throw new Error(`Workspaces endpoint returned no workspace info.`)

        return {
          type: 'workspace' as const,
          id: workspaceInfo.id,
          name: workspaceInfo.displayName,
        }
      }),
    )

    const workspaces = results
      .flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
      .sort((a, b) => a.name.localeCompare(b.name))

    this.cache.setWorkspaces(workspaces)
    return workspaces
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

        this.cache.setWorkspaces([
          ...this.cache.getWorkspaces(),
          {
            type: 'workspace',
            id,
            name: displayName,
          },
        ])
      }),
    )

    this.refreshEventEmitter.fire()
  }

  async removeWorkspace({ workspaceId }: { workspaceId: string }): Promise<void> {
    this.clients.delete(workspaceId)
    await this.connectionStringStorage.removeConnectionString({ workspaceId })
    await this.credentialsStore.deleteCredentials(workspaceId)
    this.cache.removeWorkspace(workspaceId)
    this.refreshEventEmitter.fire()
  }

  async getProjects({ workspaceId }: { workspaceId: string }): Promise<Project[]> {
    await this.waitForPreload()

    if (this.cache.hasProjects(workspaceId)) {
      return this.cache.getProjects(workspaceId)
    }

    const client = await this.getClient(workspaceId)
    const response = await client.GET('/projects')
    this.checkResponseOrThrow(workspaceId, response)

    const projects: Project[] = response.data.data.map((project) => ({
      type: 'project' as const,
      id: project.id,
      name: project.name,
      workspaceId,
    }))

    this.cache.setProjects(workspaceId, projects)
    return projects
  }

  async createProject({
    workspaceId,
    name,
    region,
    options = {},
  }: {
    workspaceId: string
    name: string
    region: string
    options?: { skipRefresh?: boolean }
  }): Promise<{ project: Project; database?: NewRemoteDatabase }> {
    this.ensureValidRegion(region)

    const client = await this.getClient(workspaceId)
    const response = await client.POST('/projects', {
      body: { name, region },
    })
    this.checkResponseOrThrow(workspaceId, response)

    const newProject: Project = {
      type: 'project' as const,
      id: response.data.id,
      name: response.data.name,
      workspaceId,
    }

    let createdDatabase: NewRemoteDatabase | undefined
    if ('databases' in response.data) {
      const databaseData = response.data.databases[0]
      if (databaseData) {
        const database: RemoteDatabase = {
          type: 'remoteDatabase' as const,
          id: databaseData.id,
          name: databaseData.name,
          region: databaseData.region,
          projectId: newProject.id,
          workspaceId,
        }

        await this.connectionStringStorage.storeConnectionString({
          workspaceId,
          projectId: newProject.id,
          databaseId: database.id,
          connectionString: databaseData.connectionString,
        })

        createdDatabase = { ...database, connectionString: databaseData.connectionString }
      }
    }

    if (!options.skipRefresh) {
      this.cache.addProject(newProject)
      if (createdDatabase) {
        this.cache.addDatabase(createdDatabase)
      }
      this.refreshEventEmitter.fire()
    }

    return { project: newProject, database: createdDatabase }
  }

  async deleteProject({ workspaceId, id }: { workspaceId: string; id: string }): Promise<void> {
    const client = await this.getClient(workspaceId)
    const response = await client.DELETE('/projects/{id}', {
      params: { path: { id } },
    })
    this.checkResponseOrThrow(workspaceId, response)

    await this.connectionStringStorage.removeConnectionString({
      workspaceId,
      projectId: id,
    })

    this.cache.removeProject(workspaceId, id)
    this.refreshEventEmitter.fire()
  }

  async getRemoteDatabases({
    workspaceId,
    projectId,
  }: {
    workspaceId: string
    projectId: string
  }): Promise<RemoteDatabase[]> {
    await this.waitForPreload()

    if (this.cache.hasDatabases(workspaceId, projectId)) {
      return this.cache.getDatabases(workspaceId, projectId)
    }

    const client = await this.getClient(workspaceId)
    const response = await client.GET('/projects/{projectId}/databases', {
      params: { path: { projectId } },
    })

    this.checkResponseOrThrow(workspaceId, response)

    const databases: RemoteDatabase[] = response.data.data.map((db) => ({
      type: 'remoteDatabase' as const,
      id: db.id,
      name: db.name,
      region: db.region,
      projectId,
      workspaceId,
    }))

    this.cache.setDatabases(workspaceId, projectId, databases)
    return databases
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
    options = {},
  }: {
    workspaceId: string
    projectId: string
    name: string
    region: string
    options?: { skipRefresh?: boolean }
  }): Promise<NewRemoteDatabase> {
    this.ensureValidRegion(region)

    const client = await this.getClient(workspaceId)
    const response = await client.POST('/projects/{projectId}/databases', {
      params: { path: { projectId } },
      body: { name, region },
    })
    this.checkResponseOrThrow(workspaceId, response)

    const newDatabase: RemoteDatabase = {
      type: 'remoteDatabase' as const,
      id: response.data.id,
      name: response.data.name,
      region: response.data.region,
      projectId,
      workspaceId,
    }

    const connectionString = response.data.connectionString

    await this.connectionStringStorage.storeConnectionString({
      workspaceId,
      projectId,
      databaseId: newDatabase.id,
      connectionString,
    })

    if (!options.skipRefresh) {
      this.cache.addDatabase(newDatabase)
      this.refreshEventEmitter.fire()
    }

    return { ...newDatabase, connectionString }
  }

  async deleteRemoteDatabase({
    workspaceId,
    projectId,
    id,
  }: {
    workspaceId: string
    projectId: string
    id: string
  }): Promise<void> {
    const client = await this.getClient(workspaceId)
    const response = await client.DELETE('/projects/{projectId}/databases/{databaseId}', {
      params: { path: { projectId, databaseId: id } },
    })
    this.checkResponseOrThrow(workspaceId, response)

    await this.connectionStringStorage.removeConnectionString({
      workspaceId,
      projectId,
      databaseId: id,
    })

    this.cache.removeDatabase(workspaceId, projectId, id)
    this.refreshEventEmitter.fire()
  }

  async getLocalDatabase(args: { name: string }): Promise<LocalDatabase | undefined> {
    const { name } = args
    const databases = await this.getLocalDatabases()
    return databases.find((db) => db.name === name)
  }

  async getLocalDatabases(): Promise<LocalDatabase[]> {
    const cached = this.cache.getLocalDatabases()
    if (cached) return cached

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

    this.cache.setLocalDatabases(data)
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

    this.refreshEventEmitter.fire()
  }

  async deleteLocalDatabase(args: { name: string }): Promise<void> {
    const { name } = args

    const database = await this.getLocalDatabase({ name })

    if (database !== undefined) {
      const databasePath = path.join(PPG_DEV_GLOBAL_ROOT.data, name)

      await this.stopLocalDatabase({ name }).catch(() => {})
      await fs.rm(databasePath, { recursive: true, force: true })
    }

    this.refreshEventEmitter.fire()
  }

  async stopLocalDatabase(args: { name: string }): Promise<void> {
    const { name } = args

    const database = await this.getLocalDatabase({ name })

    if (database?.running) {
      const { pid } = database

      process.kill(pid, 'SIGTERM')
      await waitForProcessKilled(pid)
    }

    this.refreshEventEmitter.fire()
  }

  async deployLocalDatabase(args: {
    name: string
    url: string
    projectId: string
    workspaceId: string
  }): Promise<void> {
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

    this.cache.clearDatabases(workspaceId, projectId)
    this.refreshEventEmitter.fire()
  }

  async getLocalDatabaseConnectionString(args: { name: string }) {
    const { name } = args

    const database = await this.getLocalDatabase({ name })

    if (database?.running !== true) {
      this.refreshEventEmitter.fire()
      throw new Error('This database has been deleted or stopped')
    }

    return database.url
  }
}
