import * as vscode from 'vscode'
import { LocalDatabase, PrismaPostgresItem, PrismaPostgresRepository } from './PrismaPostgresRepository'
import { LaunchArgLocal, LaunchArgRemote } from './commands/launchStudio'

export class PrismaPostgresTreeDataProvider implements vscode.TreeDataProvider<PrismaPostgresItem> {
  readonly onDidChangeTreeData: vscode.Event<PrismaPostgresItem | undefined | null | void>

  constructor(private readonly ppgRepository: PrismaPostgresRepository) {
    this.onDidChangeTreeData = ppgRepository.refreshEventEmitter.event
  }

  async getTreeItem(element: PrismaPostgresItem): Promise<vscode.TreeItem> {
    switch (element.type) {
      case 'localRoot': {
        const localDatabases = await this.ppgRepository.getLocalDatabases()

        return new PrismaLocalDatabasesItem(localDatabases)
      }
      case 'remoteRoot': {
        const isLoggedIn = await this.isLoggedIn()

        return new PrismaRemoteDatabasesItem(isLoggedIn)
      }
      case 'workspace':
        return new PrismaWorkspaceItem(element.name, element.id)
      case 'project':
        return new PrismaProjectItem(element.name, element.id, element.workspaceId)
      case 'remoteDatabase':
        return new PrismaRemoteDatabaseItem(
          element.name,
          element.region,
          element.id,
          element.projectId,
          element.workspaceId,
        )
      case 'localDatabase':
        return new PrismaLocalDatabaseItem(element)
    }
  }

  async getChildren(element?: PrismaPostgresItem): Promise<PrismaPostgresItem[]> {
    if (!element) {
      const isLoggedIn = await this.isLoggedIn()

      const children = [{ type: 'localRoot' as const }, { type: 'remoteRoot' as const }]

      if (!isLoggedIn) {
        await Promise.all([
          vscode.commands.executeCommand('setContext', 'prisma.showLoginWelcome', true),
          vscode.commands.executeCommand('setContext', 'prisma.showCreateDatabaseWelcome', false),
        ])

        return children
      }

      const hasProjects = await this.hasProjects()

      await Promise.all([
        vscode.commands.executeCommand('setContext', 'prisma.showLoginWelcome', false),
        vscode.commands.executeCommand('setContext', 'prisma.showCreateDatabaseWelcome', !hasProjects),
      ])

      return children
    }

    switch (element.type) {
      case 'localRoot':
        return this.ppgRepository.getLocalDatabases()
      case 'remoteRoot': {
        if (await this.isLoggedIn()) {
          return await this.ppgRepository.getWorkspaces()
        }

        return []
      }
      case 'workspace':
        return await this.ppgRepository.getProjects({ workspaceId: element.id })
      case 'project':
        return await this.ppgRepository.getRemoteDatabases({
          workspaceId: element.workspaceId,
          projectId: element.id,
        })
      default:
        return []
    }
  }

  async isLoggedIn(): Promise<boolean> {
    const workspaces = await this.ppgRepository.getWorkspaces()

    return workspaces.length > 0
  }

  async hasProjects(): Promise<boolean> {
    const workspaces = await this.ppgRepository.getWorkspaces()

    const projectsPerWorkspace = await Promise.all(
      workspaces.map((workspace) => this.ppgRepository.getProjects({ workspaceId: workspace.id })),
    )

    return projectsPerWorkspace.some((projects) => projects.length > 0)
  }
}

class PrismaLocalDatabasesItem extends vscode.TreeItem {
  constructor(localDatabases: LocalDatabase[]) {
    super(
      'Local Databases',
      localDatabases.length === 0 ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Expanded,
    )
  }

  id = 'local-root'

  iconPath = new vscode.ThemeIcon('device-desktop')

  contextValue = 'prismaLocalDatabasesItem'
}

class PrismaLocalDatabaseItem extends vscode.TreeItem {
  constructor(element: LocalDatabase) {
    const { id, name, running } = element

    super(name, vscode.TreeItemCollapsibleState.None)

    this.id = `local-database-${id}-${name}`

    this.iconPath = new vscode.ThemeIcon('database')

    this.contextValue = running ? 'prismaLocalDatabaseItemStarted' : 'prismaLocalDatabaseItemStopped'

    this.command = {
      command: 'prisma.studio.launchForDatabase',
      title: 'Launch Prisma Studio',
      arguments: [{ type: 'local', id, name } satisfies LaunchArgLocal],
    }
  }
}

class PrismaRemoteDatabasesItem extends vscode.TreeItem {
  constructor(isLoggedIn: boolean) {
    super(
      'Remote Databases',
      !isLoggedIn ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Expanded,
    )
  }

  id = 'remote-root'

  iconPath = new vscode.ThemeIcon('cloud')

  contextValue = 'prismaRemoteDatabasesItem'
}

class PrismaWorkspaceItem extends vscode.TreeItem {
  constructor(
    public readonly workspaceName: string,
    public readonly workspaceId: string,
  ) {
    super(workspaceName, vscode.TreeItemCollapsibleState.Expanded)
  }

  id = `workspace-${this.workspaceId}`

  iconPath = new vscode.ThemeIcon('folder')

  contextValue = 'prismaWorkspaceItem'
}

class PrismaProjectItem extends vscode.TreeItem {
  constructor(
    public readonly projectName: string,
    public readonly projectId: string,
    public readonly workspaceId: string,
  ) {
    super(projectName, vscode.TreeItemCollapsibleState.Expanded)
  }

  id = `project-${this.workspaceId}-${this.projectId}`

  iconPath = new vscode.ThemeIcon('project')

  contextValue = 'prismaProjectItem'
}

class PrismaRemoteDatabaseItem extends vscode.TreeItem {
  constructor(
    public readonly databaseName: string,
    public readonly region: string | null,
    public readonly databaseId: string,
    public readonly projectId: string,
    public readonly workspaceId: string,
  ) {
    super(databaseName, vscode.TreeItemCollapsibleState.None)
    this.description = region ? `(${region})` : false
  }

  id = `database-${this.workspaceId}-${this.projectId}-${this.databaseId}`

  iconPath = new vscode.ThemeIcon('database')

  contextValue = 'prismaRemoteDatabaseItem'

  command = {
    command: 'prisma.studio.launchForDatabase',
    title: 'Launch Prisma Studio',
    arguments: [
      {
        type: 'remote',
        workspaceId: this.workspaceId,
        projectId: this.projectId,
        databaseId: this.databaseId,
      } satisfies LaunchArgRemote,
    ],
  }
}
