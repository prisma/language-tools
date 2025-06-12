import { LocalDatabase, LocalDatabaseSchema, PrismaPostgresRepository } from '../PrismaPostgresRepository'

export async function startLocalDatabase(ppgRepository: PrismaPostgresRepository, args: unknown) {
  const { name, pid } = LocalDatabaseSchema.parse(args)

  await ppgRepository.startLocalDatabase({ pid, name })
}

export async function startLocalDatabaseSafely(ppgRepository: PrismaPostgresRepository, args: LocalDatabase) {
  return startLocalDatabase(ppgRepository, args)
}
