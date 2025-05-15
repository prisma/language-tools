import * as vscode from 'vscode'
import { PrismaPostgresRepository } from './PrismaPostgresRepository'

type PrismaItem = PrismaRemoteDatabasesItem | PrismaWorkspaceItem | PrismaRemoteDatabaseItem

export class PrismaPostgresTreeDataProvider implements vscode.TreeDataProvider<PrismaItem> {
  readonly onDidChangeTreeData: vscode.Event<PrismaItem | undefined | null | void>

  constructor(private readonly ppgRepository: PrismaPostgresRepository) {
    this.onDidChangeTreeData = ppgRepository.refreshEventEmitter.event
  }

  getTreeItem(element: PrismaItem): vscode.TreeItem {
    return element
  }

  async getChildren(element?: PrismaItem): Promise<PrismaItem[]> {
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
        return [new PrismaRemoteDatabasesItem()]
      }
    } else if (element instanceof PrismaRemoteDatabasesItem) {
      return (await this.ppgRepository.getWorkspaces()).map((w) => new PrismaWorkspaceItem(w.name, w.id))
    } else if (element instanceof PrismaWorkspaceItem) {
      return (await this.ppgRepository.getProjects({ workspaceId: element.workspaceId })).map(
        (p) => new PrismaProjectItem(p.name, p.id, p.workspaceId),
      )
    } else if (element instanceof PrismaProjectItem) {
      return (
        await this.ppgRepository.getRemoteDatabases({
          workspaceId: element.workspaceId,
          projectId: element.projectId,
        })
      ).map((r) => new PrismaRemoteDatabaseItem(r.name, r.region, r.id, r.projectId, r.workspaceId))
    } else {
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

export class PrismaRemoteDatabasesItem extends vscode.TreeItem {
  constructor() {
    super('Remote Databases', vscode.TreeItemCollapsibleState.Expanded)
  }

  iconPath = new vscode.ThemeIcon('cloud')

  contextValue = 'prismaRemoteDatabasesItem'
}

export class PrismaWorkspaceItem extends vscode.TreeItem {
  constructor(
    public readonly workspaceName: string,
    public readonly workspaceId: string,
  ) {
    super(workspaceName, vscode.TreeItemCollapsibleState.Expanded)
  }

  iconPath = new vscode.ThemeIcon('folder')

  contextValue = 'prismaWorkspaceItem'
}

export class PrismaProjectItem extends vscode.TreeItem {
  constructor(
    public readonly projectName: string,
    public readonly projectId: string,
    public readonly workspaceId: string,
  ) {
    super(projectName, vscode.TreeItemCollapsibleState.Expanded)
  }

  iconPath = new vscode.ThemeIcon('project')

  contextValue = 'prismaProjectItem'
}

export class PrismaRemoteDatabaseItem extends vscode.TreeItem {
  constructor(
    public readonly databaseName: string,
    public readonly region: string,
    public readonly databaseId: string,
    public readonly projectId: string,
    public readonly workspaceId: string,
  ) {
    super(databaseName, vscode.TreeItemCollapsibleState.None)
    this.description = `(${region})`
  }

  iconPath = new vscode.ThemeIcon('database')

  contextValue = 'prismaRemoteDatabaseItem'
}
