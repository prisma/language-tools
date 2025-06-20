import { LocalDatabase, LocalDatabaseSchema, PrismaPostgresRepository } from '../PrismaPostgresRepository'

export async function startLocalDatabase(ppgRepository: PrismaPostgresRepository, args: unknown) {
  const { name } = LocalDatabaseSchema.parse(args)

  await ppgRepository.createOrStartLocalDatabase({ name })
}

export async function startLocalDatabaseSafely(ppgRepository: PrismaPostgresRepository, args: LocalDatabase) {
  return startLocalDatabase(ppgRepository, args)
}
