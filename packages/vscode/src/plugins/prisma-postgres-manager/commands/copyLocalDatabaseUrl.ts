import { env, window } from 'vscode'
import { LocalDatabase, LocalDatabaseSchema, PrismaPostgresRepository } from '../PrismaPostgresRepository'

export async function copyLocalDatabaseUrl(ppgRepository: PrismaPostgresRepository, args: unknown) {
  const { name } = LocalDatabaseSchema.parse(args)

  const url = await ppgRepository.getLocalDatabaseConnectionString({ name })

  await env.clipboard.writeText(url)

  void window.showInformationMessage(`PPg Dev URL copied to your clipboard!`)
}

export async function copyLocalDatabaseUrlSafely(ppgRepository: PrismaPostgresRepository, args: LocalDatabase) {
  return copyLocalDatabaseUrl(ppgRepository, args)
}
