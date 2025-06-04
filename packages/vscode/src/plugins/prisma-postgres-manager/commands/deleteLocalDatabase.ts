import { PrismaPostgresRepository } from '../PrismaPostgresRepository'
import z from 'zod'

export const StopLocalDatabaseArgsSchema = z.object({
  name: z.string(),
  pid: z.number(),
  url: z.string()
})

export type StopLocalDatabaseArgs = z.infer<typeof StopLocalDatabaseArgsSchema>

export async function deleteLocalDatabase(ppgRepository: PrismaPostgresRepository, args: unknown): Promise<void> {
  const { pid, url, name } = StopLocalDatabaseArgsSchema.parse(args)

  await ppgRepository.deleteLocalDatabase({ pid, name, url })
}
