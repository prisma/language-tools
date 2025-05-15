import { ExtensionContext, window, commands, env, Uri } from 'vscode'
import {
  PrismaPostgresTreeDataProvider,
  PrismaProjectItem,
  PrismaRemoteDatabaseItem,
} from './PrismaPostgresTreeDataProvider'
import { createRemoteDatabase } from './commands/createRemoteDatabase'
import { PrismaPostgresInMemoryRepository } from './PrismaPostgresRepository'
import { createProject } from './commands/createProject'
import { deleteProject } from './commands/deleteProject'
import { deleteRemoteDatabase } from './commands/deleteRemoteDatabase'
import { handleCommandError } from './shared-ui/handleCommandError'
import { logout } from './commands/logout'
import { login } from './commands/login'

export default {
  name: 'Prisma Postgres',
  enabled() {
    return true
  },
  activate(context: ExtensionContext) {
    const ppgRepository = new PrismaPostgresInMemoryRepository()
    const ppgProvider = new PrismaPostgresTreeDataProvider(ppgRepository)

    window.registerTreeDataProvider('prismaPostgresDatabases', ppgProvider)

    context.subscriptions.push(
      commands.registerCommand('prisma.refresh', () => {
        ppgRepository.triggerRefresh()
      }),
      commands.registerCommand('prisma.login', async () => {
        await handleCommandError('Login', () => login(ppgRepository))
      }),
      commands.registerCommand('prisma.logout', async (args: unknown) => {
        await handleCommandError('Logout', () => logout(ppgRepository, args))
      }),
      commands.registerCommand('prisma.createProject', async (args: unknown) => {
        await handleCommandError('Create Project', () => createProject(ppgRepository, args))
      }),
      commands.registerCommand('prisma.deleteProject', async (args: unknown) => {
        await handleCommandError('Delete Project', () => deleteProject(ppgRepository, args))
      }),
      commands.registerCommand('prisma.openProjectInPrismaConsole', async (args: unknown) => {
        if (args instanceof PrismaProjectItem) {
          await env.openExternal(
            Uri.parse(`https://console.prisma.io/${args.workspaceId}/${args.projectId}/environments`),
          )
        } else {
          throw new Error('Invalid arguments')
        }
      }),
      commands.registerCommand('prisma.createRemoteDatabase', async (args: unknown) => {
        await handleCommandError('Create Remote Database', () => createRemoteDatabase(ppgRepository, args))
      }),
      commands.registerCommand('prisma.openRemoteDatabaseInPrismaConsole', async (args: unknown) => {
        if (args instanceof PrismaRemoteDatabaseItem) {
          await env.openExternal(
            Uri.parse(`https://console.prisma.io/${args.workspaceId}/${args.projectId}/${args.databaseId}/dashboard`),
          )
        } else {
          throw new Error('Invalid arguments')
        }
      }),
      commands.registerCommand('prisma.deleteRemoteDatabase', async (args: unknown) => {
        await handleCommandError('Delete Remote Database', () => deleteRemoteDatabase(ppgRepository, args))
      }),
    )
  },
  deactivate() {},
}
