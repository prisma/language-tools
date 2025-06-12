import { LocalDatabase, LocalDatabaseSchema, PrismaPostgresRepository } from '../PrismaPostgresRepository'

export async function stopLocalDatabase(ppgRepository: PrismaPostgresRepository, args: unknown): Promise<void> {
  const { pid, url } = LocalDatabaseSchema.parse(args)

  await ppgRepository.stopLocalDatabase({ pid, url })
}

export async function stopLocalDatabaseSafely(ppgRepository: PrismaPostgresRepository, args: LocalDatabase) {
  return stopLocalDatabase(ppgRepository, args)
}
