import { workspace, window, env, Uri, ConfigurationTarget } from 'vscode'

export const showPDPNotification = async () => {
  const pdpNotif = workspace.getConfiguration('prisma').get('pdpNotification', true)

  if (pdpNotif) {
    void window
      .showInformationMessage('Supercharge your Prisma ORM usage with global database caching, serverless connection pooling and real-time database events.', 'Visit Prisma Data Platform')
      .then((v) => {
        if (v === undefined) return

        switch (v) {
          case 'Visit Prisma Data Platform':
            void env.openExternal(Uri.parse('https://pris.ly/cli/pdp'))
            break
        }
      })
  }

  await workspace.getConfiguration('prisma').update('pdpNotification', false, ConfigurationTarget.Global)
}
