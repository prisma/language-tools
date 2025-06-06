import { ExtensionContext, window, commands, env, Uri } from 'vscode'
import { PrismaPostgresTreeDataProvider } from './PrismaPostgresTreeDataProvider'
import { createRemoteDatabase } from './commands/createRemoteDatabase'
import { isProject, isRemoteDatabase, PrismaPostgresRepository } from './PrismaPostgresRepository'
import { createProjectInclDatabase } from './commands/createProjectInclDatabase'
import { deleteProject } from './commands/deleteProject'
import { deleteRemoteDatabase } from './commands/deleteRemoteDatabase'
import { handleCommandError } from './shared-ui/handleCommandError'
import { logout } from './commands/logout'
import { login, handleAuthCallback } from './commands/login'
import { Auth } from './management-api/auth'
import { ConnectionStringStorage } from './ConnectionStringStorage'
import { getRemoteDatabaseConnectionString } from './commands/getRemoteDatabaseConnectionString'
import { launchStudio } from './commands/launchStudio'
import { createLocalDatabase } from './commands/createLocalDatabase'
import { stopLocalDatabase } from './commands/stopLocalDatabase'
import { startLocalDatabase } from './commands/startLocalDatabase'
import { copyLocalDatabaseUrl } from './commands/copyLocalDatabaseUrl'
import { deleteLocalDatabase } from './commands/deleteLocalDatabase'
import { deployLocalDatabase } from './commands/deployLocalDatabase'

export default {
  name: 'Prisma Postgres',
  enabled() {
    return true
  },
  activate(context: ExtensionContext) {
    const auth = new Auth(context.extension.id)
    const connectionStringStorage = new ConnectionStringStorage(context.secrets)
    const ppgRepository = new PrismaPostgresRepository(auth, connectionStringStorage, context)
    const ppgProvider = new PrismaPostgresTreeDataProvider(ppgRepository)

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
      commands.registerCommand('prisma.getRemoteDatabaseConnectionString', async (args: unknown) => {
        await handleCommandError('Get Connection String', () => getRemoteDatabaseConnectionString(ppgRepository, args))
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
      commands.registerCommand('prisma.studio.launchForDatabase', async (args: unknown) => {
        await handleCommandError('Launch Studio', () => launchStudio({ ppgRepository, args, context }))
      }),

      /** Local Db Commands */

      commands.registerCommand('prisma.createLocalDatabase', async () => {
        await handleCommandError('Create Local Database', () => createLocalDatabase(ppgRepository))
      }),
      commands.registerCommand('prisma.stopLocalDatabase', async (args: unknown) => {
        await handleCommandError('Stop Local Database', () => stopLocalDatabase(ppgRepository, args))
      }),
      commands.registerCommand('prisma.startLocalDatabase', async (args: unknown) => {
        await handleCommandError('Start Local Database', () => startLocalDatabase(ppgRepository, args))
      }),
      commands.registerCommand('prisma.deleteLocalDatabase', async (args: unknown) => {
        await handleCommandError('Delete Local Database', () => deleteLocalDatabase(ppgRepository, args))
      }),
      commands.registerCommand('prisma.copyLocalDatabaseURL', async (args: unknown) => {
        await handleCommandError('Copy Local Database URL', () => copyLocalDatabaseUrl(args))
      }),
      commands.registerCommand('prisma.deployLocalDatabase', async (args: unknown) => {
        await handleCommandError('Deploy Local Database', () => deployLocalDatabase(ppgRepository, args))
      }),
    )
  },
  deactivate() {},
}
