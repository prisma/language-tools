import { ExtensionContext, window, commands, env, Uri, lm } from 'vscode'
import { PrismaPostgresTreeDataProvider } from './PrismaPostgresTreeDataProvider'
import { createRemoteDatabase } from './commands/createRemoteDatabase'
import { isProject, isRemoteDatabase, PrismaPostgresRepository } from './PrismaPostgresRepository'
import { createProjectInclDatabase } from './commands/createProjectInclDatabase'
import { deleteProject } from './commands/deleteProject'
import { deleteRemoteDatabase } from './commands/deleteRemoteDatabase'
import { handleCommandError } from './shared-ui/handleCommandError'
import { logout } from './commands/logout'
import { login, handleAuthCallback } from './commands/login'
import { ConnectionStringStorage } from './ConnectionStringStorage'
import { getRemoteDatabaseConnectionString } from './commands/getRemoteDatabaseConnectionString'
import { launchStudio } from './commands/launchStudio'
import { PDPAuthLoginTool } from './ai-tools/PDPAuthLoginTool'
import { PDPCreatePPGTool } from './ai-tools/PDPCreatePPGTool'
import { deployPrismaDevInstance } from './commands/deployPrismaDevInstance'
import { PrismaDevTreeDataProvider } from './PrismaDevTreeDataProvider'
import { DevInstanceSchema, PrismaDevRepository } from './PrismaDevRepository'

export default {
  name: 'Prisma Postgres',
  enabled() {
    return true
  },
  activate(context: ExtensionContext) {
    const connectionStringStorage = new ConnectionStringStorage(context.secrets)
    const ppgRepository = new PrismaPostgresRepository(context.extension.id, connectionStringStorage)
    const prismaDevRepository = new PrismaDevRepository(context)

    window.registerUriHandler({
      handleUri(uri: Uri) {
        void handleAuthCallback({ uri, ppgRepository })
      },
    })

    window.registerTreeDataProvider('prismaPostgresDatabases', new PrismaPostgresTreeDataProvider(ppgRepository))
    window.registerTreeDataProvider('prismaDevInstances', new PrismaDevTreeDataProvider(prismaDevRepository))

    context.subscriptions.push(
      commands.registerCommand('prisma.refresh', () => {
        ppgRepository.triggerRefresh()
      }),
      commands.registerCommand('prisma.login', async (args: unknown) => {
        await handleCommandError('Login', () => login(ppgRepository, args))
      }),
      commands.registerCommand('prisma.logout', async (args: unknown) => {
        await handleCommandError('Logout', () => logout(ppgRepository, args))
      }),
      commands.registerCommand('prisma.createProject', async (args: unknown) => {
        await handleCommandError('Create Project', () => createProjectInclDatabase(ppgRepository, args, {}))
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
        await handleCommandError('Create Remote Database', () => createRemoteDatabase(ppgRepository, args, {}))
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
        await handleCommandError('Launch Studio', () =>
          launchStudio({ args, context, ppgRepository, prismaDevRepository }),
        )
      }),

      /** Local Db Commands */

      commands.registerCommand('prisma.createDevInstance', async () => {
        await handleCommandError('Create Local Database', async () => {
          const name = await window.showInputBox({
            prompt: 'Enter your `prisma dev` instance name',
            placeHolder: 'e.g., MyAwesomeProject',
            value: 'default',
          })

          await prismaDevRepository.startInstance({ name: name ?? 'default' })
        })
      }),
      commands.registerCommand('prisma.stopDevInstance', async (args: unknown) => {
        await handleCommandError('Stop Local Database', () =>
          prismaDevRepository.stopInstance(DevInstanceSchema.parse(args)),
        )
      }),
      commands.registerCommand('prisma.startDevInstance', async (args: unknown) => {
        await handleCommandError('Start Local Database', () =>
          prismaDevRepository.startInstance(DevInstanceSchema.parse(args)),
        )
      }),
      commands.registerCommand('prisma.deleteDevInstance', async (args: unknown) => {
        await handleCommandError('Delete Local Database', () =>
          prismaDevRepository.deleteInstance(DevInstanceSchema.parse(args)),
        )
      }),
      commands.registerCommand('prisma.copyDevInstanceURL', async (args: unknown) => {
        await handleCommandError('Copy Local Database URL', async () => {
          const { name } = DevInstanceSchema.parse(args)

          const url = await prismaDevRepository.getInstanceConnectionString({ name })

          await env.clipboard.writeText(url)

          await window.showInformationMessage('Prisma Dev URL copied to your clipboard!')
        })
      }),
      commands.registerCommand('prisma.deployDevInstance', async (args: unknown) => {
        await handleCommandError('Deploy Local Database', () =>
          deployPrismaDevInstance({ args, context, ppgRepository, prismaDevRepository }),
        )
      }),
    )

    context.subscriptions.push(lm.registerTool('prisma-platform-login', new PDPAuthLoginTool()))
    context.subscriptions.push(lm.registerTool('prisma-postgres-create-database', new PDPCreatePPGTool(ppgRepository)))
  },
  deactivate() {},
}
