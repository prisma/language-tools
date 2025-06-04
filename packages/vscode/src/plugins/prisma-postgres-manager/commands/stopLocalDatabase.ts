import { PrismaPostgresRepository } from '../PrismaPostgresRepository'
import z from 'zod'

export const StopLocalDatabaseArgsSchema = z.object({
  pid: z.number(),
  url: z.string()
})

export type StopLocalDatabaseArgs = z.infer<typeof StopLocalDatabaseArgsSchema>

export async function stopLocalDatabase(ppgRepository: PrismaPostgresRepository, args: unknown): Promise<void> {
  const { pid, url } = StopLocalDatabaseArgsSchema.parse(args)

  await ppgRepository.stopLocalDatabase({ pid, url })
}
