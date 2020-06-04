import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, window } from "vscode";
import { PrismaTreeItem } from './prismaTreeItem'

interface PrismaCommands {
    [title: string]: string
}

const prismaVersion = 'Prisma Version'
const prismaGenerate = 'Prisma Generate'
const prismaIntrospect = 'Prisma Introspect'

const prismaCommands: PrismaCommands = {}
prismaCommands[prismaVersion] = 'prisma -v'
prismaCommands[prismaGenerate] = 'prisma generate'
prismaCommands[prismaIntrospect] = 'prisma introspect'

export class PrismaScriptNodeProvider
    implements TreeDataProvider<PrismaTreeItem> {

    constructor() {
    }

    getTreeItem(element: PrismaTreeItem): TreeItem {
        return element
    }

    getChildren(_element?: PrismaTreeItem): Thenable<PrismaTreeItem[]> {
        return new Promise((resolve: Function) => {
            const treeItems: PrismaTreeItem[] = []
            const toScript = (
                scriptName: string,
                scriptCommand: string
            ): PrismaTreeItem => {
                const cmdObject = {
                    title: "Run command",
                    command: "prisma.executeCommand",
                    arguments: [scriptName]
                }

                return new PrismaTreeItem(
                    scriptName,
                    TreeItemCollapsibleState.None,
                    scriptCommand,
                    cmdObject
                )
            }
            treeItems.push(toScript(prismaVersion, prismaCommands[prismaVersion]))
            treeItems.push(toScript(prismaGenerate, prismaCommands[prismaGenerate]))
            treeItems.push(toScript(prismaIntrospect, prismaCommands[prismaIntrospect]))
            resolve(treeItems)
        })
    }
}

export function executeCommand() {
    return function (task: string) {
      const command: string = `npx ${prismaCommands[task]}`

      if (window.activeTerminal) {
        window.activeTerminal.show()
        window.activeTerminal.sendText(command)
      } else {
        const terminal = window.createTerminal()
        terminal.show()
        terminal.sendText(command)
      }
    }
}

