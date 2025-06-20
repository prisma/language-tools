import { LocalDatabase, LocalDatabaseSchema, PrismaPostgresRepository } from '../PrismaPostgresRepository'

export async function stopLocalDatabase(ppgRepository: PrismaPostgresRepository, args: unknown): Promise<void> {
  const { name } = LocalDatabaseSchema.parse(args)

  await ppgRepository.stopLocalDatabase({ name })
}

export async function stopLocalDatabaseSafely(ppgRepository: PrismaPostgresRepository, args: LocalDatabase) {
  return stopLocalDatabase(ppgRepository, args)
}
