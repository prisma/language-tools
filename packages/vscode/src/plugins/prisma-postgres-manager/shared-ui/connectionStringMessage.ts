import { env, window } from 'vscode'

export const presentConnectionString = async ({
  name,
  region,
  connectionString,
}: {
  name: string
  region: string | null
  connectionString: string
}) => {
  await window.showInformationMessage(
    `Remote database ${name} created${region ? ' in ' + region : ''}.`,
    {
      detail: `Connection string: ${connectionString}\n\nThis connection string will only be shown once!`,
      modal: true,
    },
    { title: 'Copy connection string', isCloseAffordance: true },
  )

  await env.clipboard.writeText(connectionString)
}
