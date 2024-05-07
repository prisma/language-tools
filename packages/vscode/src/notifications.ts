import { workspace, window, env, Uri, ConfigurationTarget } from 'vscode'

export const showPDPNotification = async () => {
  const pdpNotif = workspace.getConfiguration('prisma').get('pdpNotification', true)

  if (pdpNotif) {
    void window
      .showInformationMessage('Warning Notification With Actions', 'Action 1', 'Action 2', 'Action 3')
      .then((v) => {
        if (v === undefined) return

        switch (v) {
          case 'Action 1':
            void env.openExternal(Uri.parse('https://www.prisma.io/'))
            break

          case 'Action 2':
            break

          case 'Action 3':
            break
        }
      })
  }

  await workspace.getConfiguration('prisma').update('pdpNotification', false, ConfigurationTarget.Global)
}
