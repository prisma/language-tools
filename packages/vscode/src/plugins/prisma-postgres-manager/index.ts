import { ExtensionContext, window, commands, env, Uri } from 'vscode'
import { PrismaPostgresTreeDataProvider } from './PrismaPostgresTreeDataProvider'
import { createRemoteDatabase } from './commands/createRemoteDatabase'
import { isProject, isRemoteDatabase, PrismaPostgresApiRepository } from './PrismaPostgresRepository'
import { createProjectInclDatabase } from './commands/createProjectInclDatabase'
import { deleteProject } from './commands/deleteProject'
import { deleteRemoteDatabase } from './commands/deleteRemoteDatabase'
import { handleCommandError } from './shared-ui/handleCommandError'
import { logout } from './commands/logout'
import { login, handleAuthCallback } from './commands/login'
import { Auth } from './management-api/auth'

export default {
  name: 'Prisma Postgres',
  enabled() {
    return true
  },
  activate(context: ExtensionContext) {
    const ppgRepository = new PrismaPostgresApiRepository()
    const ppgProvider = new PrismaPostgresTreeDataProvider(ppgRepository)
    const auth = new Auth(context.extension.id)

    window.registerUriHandler({
      handleUri(uri: Uri) {
        void handleAuthCallback({ uri, ppgRepository, auth })
      },
    })

    window.registerTreeDataProvider('prismaPostgresDatabases', ppgProvider)

    context.subscriptions.push(
      commands.registerCommand('prisma.refresh', () => {
        ppgRepository.triggerRefresh()
      }),
      commands.registerCommand('prisma.login', async () => {
        await handleCommandError('Login', () => login(ppgRepository, auth))
      }),
      commands.registerCommand('prisma.logout', async (args: unknown) => {
        await handleCommandError('Logout', () => logout(ppgRepository, args))
      }),
      commands.registerCommand('prisma.createProject', async (args: unknown) => {
        await handleCommandError('Create Project', () => createProjectInclDatabase(ppgRepository, args))
      }),
      commands.registerCommand('prisma.deleteProject', async (args: unknown) => {
        await handleCommandError('Delete Project', () => deleteProject(ppgRepository, args))
      }),
      commands.registerCommand('prisma.openProjectInPrismaConsole', async (args: unknown) => {
        if (isProject(args)) {
          await env.openExternal(Uri.parse(`https://console.prisma.io/${args.workspaceId}/${args.id}/environments`))
        } else {
          throw new Error('Invalid arguments')
        }
      }),
      commands.registerCommand('prisma.createRemoteDatabase', async (args: unknown) => {
        await handleCommandError('Create Remote Database', () => createRemoteDatabase(ppgRepository, args))
      }),
      commands.registerCommand('prisma.openRemoteDatabaseInPrismaConsole', async (args: unknown) => {
        if (isRemoteDatabase(args)) {
          await env.openExternal(
            Uri.parse(`https://console.prisma.io/${args.workspaceId}/${args.projectId}/${args.id}/dashboard`),
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
