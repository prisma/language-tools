import * as vscode from 'vscode'
import { type DevInstance, PrismaDevRepository } from './PrismaDevRepository'
import type { LaunchArgLocal } from './commands/launchStudio'

export class PrismaDevTreeDataProvider implements vscode.TreeDataProvider<DevInstance> {
  readonly onDidChangeTreeData: vscode.Event<DevInstance | undefined | null | void>

  constructor(private readonly repository: PrismaDevRepository) {
    this.onDidChangeTreeData = repository.refreshEventEmitter.event
  }

  async getChildren(element?: DevInstance): Promise<DevInstance[]> {
    const devInstances = await this.repository.getInstances()

    if (!element) {
      await vscode.commands.executeCommand('setContext', 'prisma.showDevWelcome', devInstances.length === 0)
    }

    return devInstances
  }

  getTreeItem(element: DevInstance): vscode.TreeItem {
    return new DevInstanceTreeItem(element)
  }
}

class DevInstanceTreeItem extends vscode.TreeItem {
  constructor(element: DevInstance) {
    const { name, running } = element

    super(name, vscode.TreeItemCollapsibleState.None)

    this.command = {
      arguments: [{ type: 'local', name } satisfies LaunchArgLocal],
      command: 'prisma.studio.launchForDatabase',
      title: 'Launch Prisma Studio',
    }
    this.contextValue = running ? 'prismaLocalDatabaseItemStarted' : 'prismaLocalDatabaseItemStopped'
    this.iconPath = new vscode.ThemeIcon('database')
    this.id = `local-database-${name}`

    const sortedPorts = [...element.ports].sort((a, b) => a - b)

    const arePortsConsecutive = sortedPorts.every((port, index) => port === sortedPorts[0] + index)

    this.description = running
      ? `running @ ports ${arePortsConsecutive ? `${sortedPorts[0]}-${sortedPorts.at(-1)}` : sortedPorts.join(',')}`
      : 'stopped'
  }
}
