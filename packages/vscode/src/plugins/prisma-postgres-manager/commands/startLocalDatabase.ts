import { PrismaPostgresRepository } from '../PrismaPostgresRepository'
import z from 'zod'

export const StartLocalDatabaseArgsSchema = z.object({
  name: z.string(),
  pid: z.number()
})

export type StartLocalDatabaseArgs = z.infer<typeof StartLocalDatabaseArgsSchema>

export async function startLocalDatabase(ppgRepository: PrismaPostgresRepository, args: unknown) {
  const { name, pid } = StartLocalDatabaseArgsSchema.parse(args)

  await ppgRepository.startLocalDatabase({ pid, name })
}
