import { env, window } from 'vscode'

type MessageType = 'databaseCreated' | 'connectionStringCreated' | 'connectionStringDisplay'

const TITLE_COPY: Record<MessageType, string> = {
  databaseCreated: 'Database created',
  connectionStringCreated: 'Connection string created',
  connectionStringDisplay: 'Connection string',
}

export const presentConnectionString = async ({
  connectionString,
  type,
}: {
  connectionString: string
  type: MessageType
}) => {
  const truncatedConnectionString = `${connectionString.slice(0, 60)}...`
  await window.showInformationMessage(
    TITLE_COPY[type],
    {
      detail: `Connection string:\n${truncatedConnectionString}\n\nWe store this connection string securely in VSCode Secret Storage on this machine. We recommend you store it in another secure place with your application configuration, too.`,
      modal: true,
    },
    { title: 'Copy connection string', isCloseAffordance: true },
  )

  await env.clipboard.writeText(connectionString)
}
