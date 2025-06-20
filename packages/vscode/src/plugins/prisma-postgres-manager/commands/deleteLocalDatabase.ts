import { LocalDatabase, LocalDatabaseSchema, PrismaPostgresRepository } from '../PrismaPostgresRepository'

export async function deleteLocalDatabase(ppgRepository: PrismaPostgresRepository, args: unknown): Promise<void> {
  const { name } = LocalDatabaseSchema.parse(args)

  await ppgRepository.deleteLocalDatabase({ name })
}

export async function deleteLocalDatabaseSafely(ppgRepository: PrismaPostgresRepository, args: LocalDatabase) {
  return deleteLocalDatabase(ppgRepository, args)
}
