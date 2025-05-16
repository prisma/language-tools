import { commands, EventEmitter } from 'vscode'
import { createManagementAPIClient } from './management-api/client'
import { isValidRegion } from './management-api/regions'

export type Workspace = {
  id: string
  name: string
  token: string
}

export type Project = {
  id: string
  name: string
  workspaceId: string
}

export type RemoteDatabase = {
  id: string
  name: string
  region: string
  projectId: string
  workspaceId: string
}

export interface PrismaPostgresRepository {
  readonly refreshEventEmitter: EventEmitter<void>

  triggerRefresh(): void

  getRegions(): Promise<string[]>

  getWorkspaces(): Promise<Workspace[]>
  addWorkspace(params: { token: string }): Promise<void>
  removeWorkspace(params: { workspaceId: string }): Promise<void>

  getRemoteDatabases(params: { workspaceId: string; projectId: string }): Promise<RemoteDatabase[]>
  createRemoteDatabase(params: {
    workspaceId: string
    projectId: string
    name: string
    region: string
  }): Promise<RemoteDatabase & { connectionString: string }>
  deleteRemoteDatabase(params: { workspaceId: string; projectId: string; id: string } | RemoteDatabase): Promise<void>

  getProjects(params: { workspaceId: string }): Promise<Project[]>
  createProject(params: { workspaceId: string; name: string }): Promise<Project>
  deleteProject(params: { workspaceId: string; id: string } | Project): Promise<void>
}

// TODO: This is temporary in memory implementation to mock out API calls.
export class PrismaPostgresInMemoryRepository implements PrismaPostgresRepository {
  public readonly refreshEventEmitter = new EventEmitter<void>()
  private workspaces: Workspace[] = []
  private projects: Project[] = []
  private remoteDatabases: (RemoteDatabase & { connectionString: string })[] = []
  private readonly regions = ['us-east-1', 'eu-west-3', 'ap-northeast-1']

  constructor() {}

  triggerRefresh() {
    this.refreshEventEmitter.fire()
  }

  async addWorkspace({ token }: { token: string }) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const id = Math.random().toString(36).substring(7)
    this.workspaces.push({ id, name: `Personal Workspace ${id}`, token })
    this.triggerRefresh()
  }

  async removeWorkspace({ workspaceId }: { workspaceId: string }) {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    this.workspaces = this.workspaces.filter((workspace) => workspace.id !== workspaceId)
    this.triggerRefresh()
  }

  async getRegions(): Promise<string[]> {
    await new Promise((resolve) => setTimeout(resolve, 100))
    return this.regions
  }

  async getWorkspaces(): Promise<Workspace[]> {
    await commands.executeCommand('setContext', 'prisma.workspaceCount', this.workspaces.length)
    return this.workspaces
  }

  async getProjects({ workspaceId }: { workspaceId: string }): Promise<Project[]> {
    await new Promise((resolve) => setTimeout(resolve, 100))
    await commands.executeCommand('setContext', 'prisma.projectCount', this.projects.length)
    return this.projects.filter((project) => project.workspaceId === workspaceId)
  }

  async getRemoteDatabases({
    workspaceId,
    projectId,
  }: {
    workspaceId: string
    projectId: string
  }): Promise<RemoteDatabase[]> {
    await new Promise((resolve) => setTimeout(resolve, 200))
    return this.remoteDatabases.filter((db) => db.workspaceId === workspaceId && db.projectId === projectId)
  }

  async createProject({ workspaceId, name }: { workspaceId: string; name: string }): Promise<Project> {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const project: Project = {
      id: Math.random().toString(36).substring(7),
      name,
      workspaceId,
    }
    this.projects.push(project)
    return project
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
  }): Promise<RemoteDatabase & { connectionString: string }> {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const database: RemoteDatabase & { connectionString: string } = {
      id: Math.random().toString(36).substring(7),
      name,
      region,
      projectId,
      workspaceId,
      connectionString: `prisma+postgresql://${name}-${region}-${Math.random().toString(36).substring(7)}`,
    }
    this.remoteDatabases.push(database)
    return database
  }

  async deleteProject({ workspaceId, id }: { workspaceId: string; id: string } | Project): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    this.projects = this.projects.filter((project) => !(project.id === id && project.workspaceId === workspaceId))
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
    await new Promise((resolve) => setTimeout(resolve, 2000))
    this.remoteDatabases = this.remoteDatabases.filter(
      (db) => !(db.id === id && db.workspaceId === workspaceId && db.projectId === projectId),
    )
  }
}

export class PrismaPostgresApiRepository implements PrismaPostgresRepository {
  public readonly refreshEventEmitter = new EventEmitter<void>()
  private clients: Map<string, ReturnType<typeof createManagementAPIClient>> = new Map()
  private workspaces: Workspace[] = []
  private readonly regions = ['us-east-1', 'eu-west-3', 'ap-northeast-1']

  constructor() {}

  private getClient(workspaceId: string) {
    if (!this.clients.has(workspaceId)) {
      const workspace = this.workspaces.find((workspace) => workspace.id === workspaceId)
      if (!workspace) throw new Error(`Workspace ${workspaceId} not found`)
      this.clients.set(workspaceId, createManagementAPIClient(workspace.token))
    }
    return this.clients.get(workspaceId)!
  }

  private handleError(error: unknown): never {
    if (typeof error === 'object' && error !== null) {
      if ('error' in error && typeof error.error === 'object' && error.error !== null) {
        if ('message' in error.error && typeof error.error.message === 'string') {
          throw new Error(`API Error: ${error.error.message}`)
        }
      }
      if ('errorDescription' in error && typeof error.errorDescription === 'string') {
        throw new Error(`API Error: ${error.errorDescription}`)
      }
    }
    throw new Error('Unknown API error occurred')
  }

  triggerRefresh() {
    this.refreshEventEmitter.fire()
  }

  getRegions(): Promise<string[]> {
    return Promise.resolve(this.regions)
  }

  getWorkspaces(): Promise<Workspace[]> {
    return Promise.resolve(this.workspaces)
  }

  addWorkspace({ token }: { token: string }): Promise<void> {
    const fakeId = token.substring(0, 8)
    this.workspaces.push({ id: fakeId, name: `Personal Workspace ${fakeId}`, token })
    this.triggerRefresh()
    return Promise.resolve()
  }

  removeWorkspace({ workspaceId }: { workspaceId: string }): Promise<void> {
    this.workspaces = this.workspaces.filter((workspace) => workspace.id !== workspaceId)
    this.triggerRefresh()
    return Promise.resolve()
  }

  async getProjects({ workspaceId }: { workspaceId: string }): Promise<Project[]> {
    const client = this.getClient(workspaceId)
    const response = await client.GET('/projects')

    if ('error' in response) {
      this.handleError(response.error)
    }

    return response.data.data.map((project) => ({
      id: project.id,
      name: project.name,
      workspaceId,
    }))
  }

  async createProject({ workspaceId, name }: { workspaceId: string; name: string }): Promise<Project> {
    const client = this.getClient(workspaceId)
    const response = await client.POST('/projects', {
      body: {
        name,
        region: 'us-east-1',
      },
    })

    if ('error' in response) {
      this.handleError(response.error)
    }

    return {
      id: response.data.id,
      name: response.data.name,
      workspaceId,
    }
  }

  async deleteProject({ workspaceId, id }: { workspaceId: string; id: string } | Project): Promise<void> {
    const client = this.getClient(workspaceId)
    const response = await client.DELETE('/projects/{id}', {
      params: {
        path: { id },
      },
    })

    if ('error' in response) {
      this.handleError(response.error)
    }

    this.triggerRefresh()
  }

  async getRemoteDatabases({
    workspaceId,
    projectId,
  }: {
    workspaceId: string
    projectId: string
  }): Promise<RemoteDatabase[]> {
    const client = this.getClient(workspaceId)
    const response = await client.GET('/projects/{id}/databases', {
      params: {
        path: { id: projectId },
      },
    })

    if ('error' in response) {
      this.handleError(response.error)
    }

    return response.data.data.map((db) => ({
      id: db.id,
      name: db.name,
      region: db.region || 'us-east-1',
      projectId,
      workspaceId,
    }))
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
  }): Promise<RemoteDatabase & { connectionString: string }> {
    if (!isValidRegion(region)) throw new Error(`Invalid region: ${region}.`)

    const client = this.getClient(workspaceId)
    const response = await client.POST('/projects/{id}/databases', {
      params: {
        path: { id: projectId },
      },
      body: {
        name,
        region,
      },
    })

    if ('error' in response) {
      this.handleError(response.error)
    }

    this.triggerRefresh()

    return {
      id: response.data.id,
      name: response.data.name,
      region: response.data.region,
      projectId,
      workspaceId,
      connectionString: response.data.connectionString,
    }
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
    const client = this.getClient(workspaceId)
    const response = await client.DELETE('/projects/{projectId}/databases/{databaseId}', {
      params: {
        path: {
          projectId,
          databaseId: id,
        },
      },
    })

    if ('error' in response) {
      this.handleError(response.error)
    }

    this.triggerRefresh()
  }
}
