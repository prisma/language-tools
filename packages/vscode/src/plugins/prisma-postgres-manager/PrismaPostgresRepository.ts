import { EventEmitter } from 'vscode'
import { createManagementAPIClient } from './management-api/client'
import { isValidRegion, regions } from './management-api/regions'
import { CredentialsStore } from '@prisma/credentials-store'
import type { ConnectionStringStorage } from './ConnectionStringStorage'
import { Auth } from './management-api/auth'

export type WorkspaceId = string
export type Workspace = {
  type: 'workspace'
  id: WorkspaceId
  name: string
  token: string
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

export type NewlyCreatedDatabase = RemoteDatabase & { connectionString: string }

export type PrismaPostgresItem = { type: 'remoteRoot' } | Workspace | Project | RemoteDatabase

export interface PrismaPostgresRepository {
  readonly refreshEventEmitter: EventEmitter<void | PrismaPostgresItem>

  triggerRefresh(): void

  getRegions(): Promise<string[]>

  getWorkspaces(): Promise<Workspace[]>
  addWorkspace(params: { token: string; refreshToken: string }): Promise<void>
  removeWorkspace(params: { workspaceId: string }): Promise<void>

  getProjects(params: { workspaceId: string }, options?: { forceCacheRefresh: boolean }): Promise<Project[]>
  createProject(params: {
    workspaceId: string
    name: string
    region: string
  }): Promise<{ project: Project; database?: NewlyCreatedDatabase }>
  deleteProject(params: { workspaceId: string; id: string } | Project): Promise<void>

  getRemoteDatabases(
    params: { workspaceId: string; projectId: string },
    options?: { forceCacheRefresh: boolean },
  ): Promise<RemoteDatabase[]>
  createRemoteDatabase(params: {
    workspaceId: string
    projectId: string
    name: string
    region: string
  }): Promise<NewlyCreatedDatabase>
  deleteRemoteDatabase(params: { workspaceId: string; projectId: string; id: string } | RemoteDatabase): Promise<void>

  getStoredRemoteDatabaseConnectionString(params: {
    workspaceId: string
    projectId: string
    databaseId: string
  }): Promise<string | undefined>
  createRemoteDatabaseConnectionString(params: {
    workspaceId: string
    projectId: string
    databaseId: string
  }): Promise<string>
}

export class PrismaPostgresApiRepository implements PrismaPostgresRepository {
  private clients: Map<string, ReturnType<typeof createManagementAPIClient>> = new Map()
  private credentialsStore = new CredentialsStore()

  private projectsCache = new Map<WorkspaceId, Map<ProjectId, Project>>()
  private remoteDatabasesCache = new Map<string, Map<RemoteDatabaseId, RemoteDatabase>>()

  public readonly refreshEventEmitter = new EventEmitter<void | PrismaPostgresItem>()

  constructor(
    private readonly auth: Auth,
    private readonly connectionStringStorage: ConnectionStringStorage,
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
      throw new Error(`Credentials for workspace expired. Please login again.`)
    }

    const error = response.error
    if (typeof error === 'object' && error !== null) {
      if ('error' in error && typeof error === 'object' && error !== null) {
        if ('message' in error && typeof error.message === 'string') {
          throw new Error(`API Error: ${error.message}`)
        }
      }
      if ('errorDescription' in error && typeof error.errorDescription === 'string') {
        throw new Error(`API Error: ${error.errorDescription}`)
      }
    }

    throw new Error(`Unknown API error occurred. Status Code: ${response.response.status}.`)
  }

  triggerRefresh() {
    void this.credentialsStore.reloadCredentialsFromDisk()
    // Wipe caches
    this.projectsCache = new Map()
    this.remoteDatabasesCache = new Map()
    // Trigger full tree view refresh which will fetch fresh data on demand due to cache misses
    this.refreshEventEmitter.fire()
  }

  getRegions(): Promise<string[]> {
    return Promise.resolve(regions.slice())
  }

  async getWorkspaces(): Promise<Workspace[]> {
    const credentials = await this.credentialsStore.getCredentials()
    return credentials.map((cred) => ({
      type: 'workspace',
      id: cred.workspaceId,
      name: `Personal Workspace ${cred.workspaceId}`, // TODO: pending /me endpoint api
      token: cred.token,
    }))
  }

  async addWorkspace({ token, refreshToken }: { token: string; refreshToken: string }): Promise<void> {
    const fakeId = token.substring(0, 8)
    await this.credentialsStore.storeCredentials({
      userId: 'prisma', // TODO: pending /me endpoint api
      workspaceId: fakeId,
      token,
      refreshToken,
    })
    this.refreshEventEmitter.fire()
    return Promise.resolve()
  }

  async removeWorkspace({ workspaceId }: { workspaceId: string }): Promise<void> {
    this.clients.delete(workspaceId)
    await this.connectionStringStorage.removeConnectionString({ workspaceId })
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
  }: {
    workspaceId: string
    name: string
    region: string
  }): Promise<{ project: Project; database?: NewlyCreatedDatabase }> {
    if (!isValidRegion(region)) throw new Error(`Invalid region: ${region}.`)

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
          region: null,
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

    // Proactively update cache
    this.projectsCache.get(workspaceId)?.set(newProject.id, newProject)
    this.remoteDatabasesCache.set(
      `${workspaceId}.${newProject.id}`,
      new Map(createdDatabase ? [[createdDatabase.id, createdDatabase]] : []),
    )
    this.refreshEventEmitter.fire()
    // And then refresh list from server in background
    void this.refreshProjects({ workspaceId })

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
  }: {
    workspaceId: string
    projectId: string
    name: string
    region: string
  }): Promise<NewlyCreatedDatabase> {
    if (!isValidRegion(region)) throw new Error(`Invalid region: ${region}.`)

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

    // Proactively update cache
    this.remoteDatabasesCache.get(workspaceId)?.set(newDatabase.id, newDatabase)
    this.refreshEventEmitter.fire()
    // And then refresh list from server in background
    void this.refreshRemoteDatabases({ workspaceId, projectId })

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
}
