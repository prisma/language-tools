import * as vscode from 'vscode'
import { PrismaPostgresItem, PrismaPostgresRepository } from './PrismaPostgresRepository'

export class PrismaPostgresTreeDataProvider implements vscode.TreeDataProvider<PrismaPostgresItem> {
  readonly onDidChangeTreeData: vscode.Event<PrismaPostgresItem | undefined | null | void>

  constructor(private readonly ppgRepository: PrismaPostgresRepository) {
    this.onDidChangeTreeData = ppgRepository.refreshEventEmitter.event
  }

  getTreeItem(element: PrismaPostgresItem): vscode.TreeItem {
    switch (element.type) {
      case 'remoteRoot':
        return new PrismaRemoteDatabasesItem()
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
    }
  }

  async getChildren(element?: PrismaPostgresItem): Promise<PrismaPostgresItem[]> {
    if (!element) {
      if (await this.shouldShowLoginWelcome()) {
        await vscode.commands.executeCommand('setContext', 'prisma.showLoginWelcome', true)
        await vscode.commands.executeCommand('setContext', 'prisma.showCreateDatabaseWelcome', false)
        return []
      } else if (await this.shouldShowCreateDatabaseWelcome()) {
        await vscode.commands.executeCommand('setContext', 'prisma.showLoginWelcome', false)
        await vscode.commands.executeCommand('setContext', 'prisma.showCreateDatabaseWelcome', true)
        return []
      } else {
        await vscode.commands.executeCommand('setContext', 'prisma.showLoginWelcome', false)
        await vscode.commands.executeCommand('setContext', 'prisma.showCreateDatabaseWelcome', false)
        return [{ type: 'remoteRoot' }]
      }
    }

    switch (element.type) {
      case 'remoteRoot':
        return await this.ppgRepository.getWorkspaces()
      case 'workspace':
        return await this.ppgRepository.getProjects({ workspaceId: element.id })
      case 'project':
        return await this.ppgRepository.getRemoteDatabases({
          workspaceId: element.workspaceId,
          projectId: element.id,
        })
      case 'remoteDatabase':
        return []
    }
  }

  async shouldShowLoginWelcome(): Promise<boolean> {
    return (await this.ppgRepository.getWorkspaces()).length === 0
  }

  async shouldShowCreateDatabaseWelcome(): Promise<boolean> {
    const res = await Promise.all(
      (await this.ppgRepository.getWorkspaces()).map(
        async (w) => await this.ppgRepository.getProjects({ workspaceId: w.id }),
      ),
    )
    return res.flat().length === 0
  }
}

class PrismaRemoteDatabasesItem extends vscode.TreeItem {
  constructor() {
    super('Remote Databases', vscode.TreeItemCollapsibleState.Expanded)
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
}
