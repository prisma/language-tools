import { isWorkspace, PrismaPostgresRepository } from '../PrismaPostgresRepository'
import { pickWorkspace } from '../shared-ui/pickWorkspace'

export const logout = async (ppgRepository: PrismaPostgresRepository, args: unknown) => {
  let workspaceId: string
  if (isWorkspace(args)) {
    workspaceId = args.id
  } else {
    workspaceId = (await pickWorkspace(ppgRepository)).id
  }

  await ppgRepository.removeWorkspace({ workspaceId })
}
