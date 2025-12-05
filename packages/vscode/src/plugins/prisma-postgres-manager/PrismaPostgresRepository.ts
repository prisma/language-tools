import { env, EventEmitter, Uri } from 'vscode'
import {
  createManagementAPI,
  createManagementAPIClient,
  type ManagementAPI,
  type LoginResult,
  type operations,
} from '@prisma/management-api-sdk'
import { CredentialsStore } from '@prisma/credentials-store'
import type { ConnectionStringStorage } from './ConnectionStringStorage'
import { z } from 'zod'
import { WorkspaceTokenStorage, PendingTokenStorage } from './WorkspaceTokenStorage'

const CLIENT_ID = 'cmamnw2go00005812nlbzb4pi'
const DEFAULT_UTM_MEDIUM = 'ppg-cloud-list'

// Response types from SDK operations
type ProjectsResponse = operations['getV1Projects']['responses']['200']['content']['application/json']
type ProjectsErrorResponse = operations['getV1Projects']['responses']['401']['content']['application/json']
type DatabasesResponse =
  operations['getV1ProjectsByProjectIdDatabases']['responses']['200']['content']['application/json']
type DatabasesErrorResponse =
  operations['getV1ProjectsByProjectIdDatabases']['responses']['401']['content']['application/json']

// Generic API response type for type assertions
type APIResponse<TData, TError> = { data?: TData; error?: TError; response: Response }

export type LoginOptions = {
  utmMedium?: string
}

export type RegionId = 'us-east-1' | 'us-west-1' | 'eu-west-3' | 'eu-central-1' | 'ap-northeast-1' | 'ap-southeast-1'
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

export const DatabaseSchema = z.object({
  type: z.literal('remoteDatabase'),
  id: z.string(),
  name: z.string(),
  region: z.string().nullable(),
  projectId: z.string(),
  workspaceId: z.string(),
})
export type DatabaseId = string
export type Database = z.infer<typeof DatabaseSchema>
export function isRemoteDatabase(item: unknown): item is Database {
  return DatabaseSchema.safeParse(item).success
}

export type NewRemoteDatabase = Database & { connectionString: string | null }

export type PrismaPostgresItem = Workspace | Project | Database

// Simple cache manager to handle all caching logic
class CacheManager {
  private regions: Region[] = []
  private workspaces = new Map<WorkspaceId, Workspace>()
  private projects = new Map<string, Map<ProjectId, Project>>()
  private databases = new Map<string, Map<DatabaseId, Database>>()

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
  setDatabases(workspaceId: string, projectId: string, databases: Database[]): void {
    const databaseMap = new Map<DatabaseId, Database>()
    databases.forEach((db) => databaseMap.set(db.id, db))
    this.databases.set(this.generateKey(workspaceId, projectId), databaseMap)
  }

  getDatabases(workspaceId: string, projectId: string): Database[] {
    return Array.from(this.databases.get(this.generateKey(workspaceId, projectId))?.values() || [])
  }

  hasDatabases(workspaceId: string, projectId: string): boolean {
    return this.databases.has(this.generateKey(workspaceId, projectId))
  }

  addDatabase(database: Database): void {
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

  clearAll(): void {
    this.workspaces.clear()
    this.projects.clear()
    this.databases.clear()
    this.regions = []
  }
}

export class PrismaPostgresRepository {
  private reloadPromise: Promise<void> | undefined = undefined
  private managementAPIs = new Map<string, ManagementAPI>()
  private credentialsStore = new CredentialsStore()
  private cache = new CacheManager()

  // Auth state
  private authAPI: ManagementAPI | null = null
  private pendingTokenStorage = new PendingTokenStorage()
  private latestLoginResult: LoginResult | null = null

  public readonly refreshEventEmitter = new EventEmitter<void | PrismaPostgresItem>()

  constructor(
    private readonly extensionId: string,
    private readonly connectionStringStorage: ConnectionStringStorage,
  ) {
    // Start preloading data in the background for better UX
    this.reloadPromise = this.reloadAllData()
  }

  private getRedirectUri(): string {
    return `${env.uriScheme}://${this.extensionId.toLowerCase()}/auth/callback`
  }

  /**
   * Get the cached auth API instance (used for login flows).
   * Reuses a single instance instead of creating fresh ones each time.
   */
  private getAuthAPI(): ManagementAPI {
    if (!this.authAPI) {
      this.authAPI = createManagementAPI({
        clientId: CLIENT_ID,
        redirectUri: this.getRedirectUri(),
        tokenStorage: this.pendingTokenStorage,
      })
    }
    return this.authAPI
  }

  /**
   * Initiates the OAuth login flow by opening the browser.
   */
  async login(options: LoginOptions = {}): Promise<void> {
    const result = await this.getAuthAPI().getLoginUrl({
      scope: 'workspace:admin offline_access',
      additionalParams: {
        utm_source: 'vscode',
        utm_medium: options.utmMedium ?? DEFAULT_UTM_MEDIUM,
      },
    })

    this.latestLoginResult = result
    await env.openExternal(Uri.parse(result.url))
  }

  /**
   * Handles the OAuth callback after browser authentication.
   * Returns true if this was an auth callback that was handled, false otherwise.
   */
  async handleAuthCallback(uri: Uri): Promise<boolean> {
    if (uri.path !== '/auth/callback') return false
    if (!this.latestLoginResult) {
      throw new Error('No login in progress')
    }

    const { state, verifier } = this.latestLoginResult

    await this.getAuthAPI().handleCallback({
      callbackUrl: `${this.getRedirectUri()}?${uri.query}`,
      verifier,
      expectedState: state,
    })

    // Tokens are now stored in pendingTokenStorage via handleCallback
    const tokens = this.pendingTokenStorage.consumeTokens()
    this.latestLoginResult = null

    if (!tokens) {
      throw new Error('No tokens received from callback')
    }

    // Discover workspaces and store credentials per workspace
    await this.addWorkspace({ token: tokens.accessToken, refreshToken: tokens.refreshToken })

    return true
  }

  private async reloadAllData(): Promise<void> {
    // Only one reload at once
    if (this.reloadPromise) {
      return
    }

    // Empty all the caches
    this.cache.clearAll()

    try {
      // Load the regions
      const regionsPromise = this.getRegions({ reload: true })

      // Load workspaces first
      const workspaces = await this.getWorkspaces({ reload: true })

      // Load projects for all workspaces in parallel
      const projectPromises = workspaces.map(async (workspace) => {
        const projects = await this.getProjects({ workspaceId: workspace.id, reload: true })

        // Load databases for all projects in parallel
        const databasePromises = projects.map((project) =>
          this.getRemoteDatabases({ workspaceId: workspace.id, projectId: project.id, reload: true }),
        )

        // Wait for all databases to load (but don't block other workspaces)
        await Promise.allSettled(databasePromises)
        return projects
      })

      // Wait for all workspaces to finish loading their projects and databases
      await Promise.allSettled([...projectPromises, regionsPromise])
    } catch (error) {
      console.error('Error reloading data:', error)
      // Don't throw - preloading is optional for UX, shouldn't break functionality
    } finally {
      this.reloadPromise = undefined
    }
  }

  private getAPI(workspaceId: string): ManagementAPI {
    const strippedWorkspaceId = stripResourceIdentifierPrefix(workspaceId)

    if (!this.managementAPIs.has(strippedWorkspaceId)) {
      const api = createManagementAPI({
        clientId: CLIENT_ID,
        redirectUri: this.getRedirectUri(),
        tokenStorage: new WorkspaceTokenStorage(strippedWorkspaceId, this.credentialsStore),
      })

      this.managementAPIs.set(strippedWorkspaceId, api)
    }

    return this.managementAPIs.get(strippedWorkspaceId)!
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
    this.reloadPromise = this.reloadAllData()
    this.refreshEventEmitter.fire()
  }

  async getRegions({ reload }: { reload?: boolean } = {}): Promise<Region[]> {
    if (!reload) {
      await this.reloadPromise
    }

    if (this.cache.hasRegions()) {
      return this.cache.getRegions()
    }

    const workspaces = await this.getWorkspaces()
    const workspaceId = workspaces[0]?.id
    if (!workspaceId) return []

    const api = this.getAPI(workspaceId)
    const response = await api.client.GET('/v1/regions/postgres')
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

  async getWorkspaces({ reload }: { reload?: boolean } = {}): Promise<Workspace[]> {
    if (!reload) {
      await this.reloadPromise
    }

    if (this.cache.hasWorkspaces()) {
      return this.cache.getWorkspaces()
    }

    const credentials = await this.credentialsStore.getCredentials()

    const results = await Promise.allSettled(
      credentials.map(async (cred) => {
        const api = this.getAPI(cred.workspaceId)

        const response = await api.client.GET('/v1/workspaces')

        this.checkResponseOrThrow(cred.workspaceId, response)

        const [workspace] = response.data.data

        if (!workspace) {
          throw new Error(`Workspaces endpoint returned no workspace info.`)
        }

        return {
          id: stripResourceIdentifierPrefix(workspace.id),
          name: workspace.name,
          type: 'workspace' as const,
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
    // Create a temporary client to fetch workspace info
    const client = createManagementAPIClient({
      baseUrl: 'https://api.prisma.io',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const response = await client.GET('/v1/workspaces')

    if (response.error) {
      throw new Error(`Failed to retrieve workspace information.`)
    }

    const { data: workspaces } = response.data as {
      data: Array<{ id: string; name: string; type: string; createdAt: string }>
    }

    if (workspaces.length === 0) {
      throw new Error(`Received token does not grant access to any workspaces.`)
    }

    await Promise.all(
      workspaces.map(async ({ id, name }: { id: string; name: string }) => {
        const strippedWorkspaceId = stripResourceIdentifierPrefix(id)

        await this.credentialsStore.storeCredentials({
          refreshToken,
          token,
          workspaceId: strippedWorkspaceId,
        })

        this.cache.setWorkspaces([...this.cache.getWorkspaces(), { id: strippedWorkspaceId, name, type: 'workspace' }])
      }),
    )

    this.refreshEventEmitter.fire()
  }

  async removeWorkspace({ workspaceId }: { workspaceId: string }): Promise<void> {
    this.managementAPIs.delete(workspaceId)
    await this.connectionStringStorage.removeConnectionString({ workspaceId })
    await this.credentialsStore.deleteCredentials(workspaceId)
    await this.credentialsStore.deleteCredentials(`wksp_${workspaceId}`)
    this.cache.removeWorkspace(workspaceId)
    this.refreshEventEmitter.fire()
  }

  async getProjects({ workspaceId, reload }: { workspaceId: string; reload?: boolean }): Promise<Project[]> {
    if (!reload) {
      await this.reloadPromise
    }

    if (this.cache.hasProjects(workspaceId)) {
      return this.cache.getProjects(workspaceId)
    }

    const api = this.getAPI(workspaceId)

    const projects: Project[] = []
    let pagination: { hasMore: boolean; nextCursor: string | null | undefined } | undefined = undefined

    do {
      const response: APIResponse<ProjectsResponse, ProjectsErrorResponse> = await api.client.GET('/v1/projects', {
        params: {
          query: { cursor: pagination?.nextCursor || null, limit: 100 },
        },
      })

      this.checkResponseOrThrow(workspaceId, response)

      const data = response.data
      pagination = data.pagination

      projects.push(
        ...data.data.map((project) => ({
          id: stripResourceIdentifierPrefix(project.id),
          name: project.name,
          type: 'project' as const,
          workspaceId,
        })),
      )
    } while (pagination?.hasMore)

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
  }): Promise<{ project: Project; database: NewRemoteDatabase | null }> {
    this.ensureValidRegion(region)

    const api = this.getAPI(workspaceId)

    const response = await api.client.POST('/v1/projects', {
      body: { name, region },
    })

    this.checkResponseOrThrow(workspaceId, response)

    const { database, ...project } = response.data.data

    const strippedProjectId = stripResourceIdentifierPrefix(project.id)

    const simplifiedProject: Project = {
      id: strippedProjectId,
      name: project.name,
      type: project.type,
      workspaceId,
    }

    if (!database) {
      return { database: null, project: simplifiedProject }
    }

    const { connectionString } = database

    const strippedDatabaseId = stripResourceIdentifierPrefix(database.id)

    if (connectionString) {
      await this.connectionStringStorage.storeConnectionString({
        connectionString,
        databaseId: strippedDatabaseId,
        projectId: strippedProjectId,
        workspaceId,
      })
    }

    const simplifiedDatabase: NewRemoteDatabase = {
      connectionString,
      id: strippedDatabaseId,
      name: database.name,
      projectId: strippedProjectId,
      region: database.region.name,
      type: 'remoteDatabase' as const,
      workspaceId,
    }

    if (!options.skipRefresh) {
      this.cache.addProject(simplifiedProject)
      this.cache.addDatabase(simplifiedDatabase)

      this.refreshEventEmitter.fire()
    }

    return { database: simplifiedDatabase, project: simplifiedProject }
  }

  async deleteProject({ workspaceId, id }: { workspaceId: string; id: string }): Promise<void> {
    const api = this.getAPI(workspaceId)

    const response = await api.client.DELETE('/v1/projects/{id}', {
      params: { path: { id } },
    })

    this.checkResponseOrThrow(workspaceId, response)

    await this.connectionStringStorage.removeConnectionString({ projectId: id, workspaceId })

    this.cache.removeProject(workspaceId, id)
    this.refreshEventEmitter.fire()
  }

  async getRemoteDatabases({
    workspaceId,
    projectId,
    reload,
  }: {
    workspaceId: string
    projectId: string
    reload?: boolean
  }): Promise<Database[]> {
    if (!reload) {
      await this.reloadPromise
    }

    if (this.cache.hasDatabases(workspaceId, projectId)) {
      return this.cache.getDatabases(workspaceId, projectId)
    }

    const api = this.getAPI(workspaceId)

    const databases: Database[] = []
    let pagination: { hasMore: boolean; nextCursor: string | null | undefined } | undefined = undefined

    do {
      const response: APIResponse<DatabasesResponse, DatabasesErrorResponse> = await api.client.GET(
        '/v1/projects/{projectId}/databases',
        {
          params: {
            path: { projectId },
            query: { cursor: pagination?.nextCursor || null, limit: 100 },
          },
        },
      )

      this.checkResponseOrThrow(workspaceId, response)

      const data = response.data
      pagination = data.pagination

      databases.push(
        ...data.data.map((database) => ({
          id: stripResourceIdentifierPrefix(database.id),
          name: database.name,
          projectId,
          region: database.region?.name ?? null,
          type: 'remoteDatabase' as const,
          workspaceId,
        })),
      )
    } while (pagination?.hasMore)

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
    const api = this.getAPI(workspaceId)

    const response = await api.client.POST('/v1/databases/{databaseId}/connections', {
      params: {
        path: { databaseId },
      },
      body: {
        name: "Created by Prisma's VSCode Extension",
      },
    })

    this.checkResponseOrThrow(workspaceId, response)

    const { connectionString } = response.data.data

    await this.connectionStringStorage.storeConnectionString({ connectionString, databaseId, projectId, workspaceId })

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

    const api = this.getAPI(workspaceId)

    const response = await api.client.POST('/v1/projects/{projectId}/databases', {
      params: { path: { projectId } },
      body: { name, region },
    })

    this.checkResponseOrThrow(workspaceId, response)

    const { data: database } = response.data

    const { connectionString, id } = database

    const strippedDatabaseId = stripResourceIdentifierPrefix(id)

    if (connectionString) {
      await this.connectionStringStorage.storeConnectionString({
        connectionString,
        databaseId: strippedDatabaseId,
        projectId,
        workspaceId,
      })
    }

    const simplifiedDatabase: NewRemoteDatabase = {
      connectionString,
      id: strippedDatabaseId,
      name: database.name,
      region: database.region.name,
      projectId,
      type: 'remoteDatabase' as const,
      workspaceId,
    }

    if (!options.skipRefresh) {
      this.cache.addDatabase(simplifiedDatabase)

      this.refreshEventEmitter.fire()
    }

    return simplifiedDatabase
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
    const api = this.getAPI(workspaceId)

    const response = await api.client.DELETE('/v1/databases/{databaseId}', {
      params: { path: { databaseId: id } },
    })

    this.checkResponseOrThrow(workspaceId, response)

    await this.connectionStringStorage.removeConnectionString({ databaseId: id, projectId, workspaceId })

    this.cache.removeDatabase(workspaceId, projectId, id)

    this.refreshEventEmitter.fire()
  }
}

/**
 * Management API returns resource identifiers with prefixes like `proj_<projectId>` for projects, `db_<databaseId>` for databases, etc.
 *
 * This function strips those prefixes to get the actual ID to normalize them across the extension.
 *
 * The PDP Console application doesn't use these prefixes in their URLs either.
 */
function stripResourceIdentifierPrefix(identifier: string): string {
  return identifier.slice(identifier.indexOf('_') + 1)
}
