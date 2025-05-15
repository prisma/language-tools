import { PrismaPostgresRepository } from '../PrismaPostgresRepository'
import { PrismaWorkspaceItem } from '../PrismaPostgresTreeDataProvider'
import { pickWorkspace } from '../shared-ui/pickWorkspace'

export const logout = async (ppgRepository: PrismaPostgresRepository, args: unknown) => {
  let workspaceId: string
  if (args instanceof PrismaWorkspaceItem) {
    workspaceId = args.workspaceId
  } else {
    workspaceId = (await pickWorkspace(ppgRepository)).id
  }

  await ppgRepository.workspaceLogout({ workspaceId })
}
