import { PrismaPostgresRepository } from '../PrismaPostgresRepository'
import z from 'zod'

export const DeleteLocalDatabaseArgsSchema = z.object({
  name: z.string(),
  pid: z.number(),
  url: z.string(),
})

export type DeleteLocalDatabaseArgs = z.infer<typeof DeleteLocalDatabaseArgsSchema>

export async function deleteLocalDatabase(ppgRepository: PrismaPostgresRepository, args: unknown): Promise<void> {
  const { pid, url, name } = DeleteLocalDatabaseArgsSchema.parse(args)

  await ppgRepository.deleteLocalDatabase({ pid, name, url })
}

export async function deleteLocalDatabaseSafely(
  ppgRepository: PrismaPostgresRepository,
  args: DeleteLocalDatabaseArgs,
) {
  return deleteLocalDatabase(ppgRepository, args)
}
