import { workspace, window, env, Uri, ConfigurationTarget } from 'vscode'

export const showPDPNotification = async () => {
  const pdpNotif = workspace.getConfiguration('prisma').get('showPrismaDataPlatformNotification', true)

  if (!pdpNotif) return

  void window
    .showInformationMessage(
      'Supercharge your Prisma ORM usage with global database caching, serverless connection pooling and real-time database events.',
      'Visit Prisma Data Platform',
    )
    .then((v) => {
      if (v === undefined) return

      void env.openExternal(Uri.parse('https://pris.ly/vscode/pdp'))
    })

  await workspace
    .getConfiguration('prisma')
    .update('showPrismaDataPlatformNotification', false, ConfigurationTarget.Global)
}
