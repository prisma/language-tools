import { env, window } from 'vscode'
import { LocalDatabase, LocalDatabaseSchema } from '../PrismaPostgresRepository'

export async function copyLocalDatabaseUrl(args: unknown) {
  const item = LocalDatabaseSchema.parse(args)

  await env.clipboard.writeText(item.url)

  void window.showInformationMessage(`PPg Dev URL copied to your clipboard!`)
}

export async function copyLocalDatabaseUrlSafely(args: LocalDatabase) {
  return copyLocalDatabaseUrl(args)
}
