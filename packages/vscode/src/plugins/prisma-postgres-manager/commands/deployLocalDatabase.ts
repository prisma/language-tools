import { PrismaPostgresRepository } from '../PrismaPostgresRepository'
import z from 'zod'

export const DeployLocalDatabaseArgsSchema = z.object({
  name: z.string(),
})

export type DeployLocalDatabaseArgs = z.infer<typeof DeployLocalDatabaseArgsSchema>

export async function deployLocalDatabase(ppgRepository: PrismaPostgresRepository, args: unknown): Promise<void> {
  const { name } = DeployLocalDatabaseArgsSchema.parse(args)

  await ppgRepository.deployLocalDatabase({ name })
}
