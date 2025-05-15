import { commands, EventEmitter } from 'vscode'

export type Workspace = {
  id: string
  name: string
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
  workspaceLogin(): Promise<void>
  workspaceLogout(params: { workspaceId: string }): Promise<void>

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

  async workspaceLogin() {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const id = Math.random().toString(36).substring(7)
    this.workspaces.push({ id, name: `Personal Workspace ${id}` })
    this.triggerRefresh()
  }

  async workspaceLogout({ workspaceId }: { workspaceId: string }) {
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
