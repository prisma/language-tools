import { EventEmitter } from 'vscode'
import { createManagementAPIClient } from './management-api/client'
import { CredentialsStore } from '@prisma/credentials-store'
import type { ConnectionStringStorage } from './ConnectionStringStorage'
import { Auth } from './management-api/auth'
import type { paths } from './management-api/api.d'
import { z } from 'zod'
import type { FetchResponse } from 'openapi-fetch'

export type RegionId = NonNullable<
  NonNullable<
    paths['/v1/projects/{projectId}/databases']['post']['requestBody']
  >['content']['application/json']['region']
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
  private clients = new Map<string, ReturnType<typeof createManagementAPIClient>>()
  private credentialsStore = new CredentialsStore()
  private cache = new CacheManager()

  public readonly refreshEventEmitter = new EventEmitter<void | PrismaPostgresItem>()

  constructor(
    private readonly auth: Auth,
    private readonly connectionStringStorage: ConnectionStringStorage,
  ) {
    // Start preloading data in the background for better UX
    this.reloadPromise = this.reloadAllData()
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

  private async getClient(workspaceId: string) {
    const strippedWorkspaceId = stripResourceIdentifierPrefix(workspaceId)

    if (!this.clients.has(strippedWorkspaceId)) {
      await this.credentialsStore.reloadCredentialsFromDisk()

      const credentials =
        (await this.credentialsStore.getCredentialsForWorkspace(strippedWorkspaceId)) ||
        (await this.credentialsStore.getCredentialsForWorkspace(workspaceId))

      if (!credentials) {
        throw new Error(`Workspace '${strippedWorkspaceId}' not found`)
      }

      const refreshTokenHandler = async () => {
        const credentials =
          (await this.credentialsStore.getCredentialsForWorkspace(strippedWorkspaceId)) ||
          (await this.credentialsStore.getCredentialsForWorkspace(workspaceId))

        if (!credentials) {
          throw new Error(`Workspace '${strippedWorkspaceId}' not found`)
        }

        const refreshTokenResult = await this.auth.refreshToken(credentials.refreshToken)

        if (refreshTokenResult.status === 'success') {
          await this.credentialsStore.storeCredentials({
            workspaceId: strippedWorkspaceId,
            token: refreshTokenResult.token,
            refreshToken: refreshTokenResult.refreshToken,
          })

          return { token: refreshTokenResult.token }
        } else if (refreshTokenResult.refreshTokenInvalid) {
          await this.credentialsStore.deleteCredentials(strippedWorkspaceId)
          throw new Error(
            `Refresh token was invalid for workspace ${strippedWorkspaceId}. Credentials have been removed.`,
          )
        } else {
          throw new Error(`Failed to refresh token. Please try again.`)
        }
      }

      const client = createManagementAPIClient(credentials.token, refreshTokenHandler)

      this.clients.set(strippedWorkspaceId, client)
    }

    return this.clients.get(strippedWorkspaceId)!
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

    const client = await this.getClient(workspaceId)
    const response = await client.GET('/v1/regions/postgres')
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
        const client = await this.getClient(cred.workspaceId)

        const response = await client.GET('/v1/workspaces')

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
    const client = createManagementAPIClient(token, () => {
      throw new Error('Received token has to be instantly refreshed. Something is wrong.')
    })

    const response = await client.GET('/v1/workspaces')

    if (response.error) {
      throw new Error(`Failed to retrieve workspace information.`)
    }

    const { data: workspaces } = response.data

    if (workspaces.length === 0) {
      throw new Error(`Received token does not grant access to any workspaces.`)
    }

    await Promise.all(
      workspaces.map(async ({ id, name }) => {
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
    this.clients.delete(workspaceId)
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

    const client = await this.getClient(workspaceId)

    const projects: Project[] = []
    let pagination: { hasMore: boolean; nextCursor: string | null | undefined } | undefined = undefined

    do {
      const response = (await client.GET('/v1/projects', {
        params: {
          query: { cursor: pagination?.nextCursor || null, limit: 100 },
        },
      })) as FetchResponse<paths['/v1/projects']['get'], undefined, `${string}/${string}`>

      this.checkResponseOrThrow(workspaceId, response)

      const { data } = response

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

    const client = await this.getClient(workspaceId)

    const response = await client.POST('/v1/projects', {
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
    const client = await this.getClient(workspaceId)

    const response = await client.DELETE('/v1/projects/{id}', {
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

    const client = await this.getClient(workspaceId)

    const databases: Database[] = []
    let pagination: { hasMore: boolean; nextCursor: string | null | undefined } | undefined = undefined

    do {
      const response = (await client.GET('/v1/projects/{projectId}/databases', {
        params: {
          path: { projectId },
          query: { cursor: pagination?.nextCursor || null, limit: 100 },
        },
      })) as FetchResponse<paths['/v1/projects/{projectId}/databases']['get'], undefined, `${string}/${string}`>

      this.checkResponseOrThrow(workspaceId, response)

      const { data } = response

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
    const client = await this.getClient(workspaceId)

    const response = await client.POST('/v1/databases/{databaseId}/connections', {
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

    const client = await this.getClient(workspaceId)

    const response = await client.POST('/v1/projects/{projectId}/databases', {
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
    const client = await this.getClient(workspaceId)

    const response = await client.DELETE('/v1/databases/{databaseId}', {
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
