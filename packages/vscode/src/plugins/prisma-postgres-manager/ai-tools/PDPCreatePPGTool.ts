import type {
  LanguageModelToolInvocationOptions,
  LanguageModelTool,
  ProviderResult,
  PreparedToolInvocation,
  CancellationToken,
  LanguageModelToolInvocationPrepareOptions,
} from 'vscode'
import { LanguageModelToolResult, LanguageModelTextPart } from 'vscode'
import { PrismaPostgresRepository, Workspace } from '../PrismaPostgresRepository'

type PDPCreatePPGToolInput = { name: string; workspaceId?: string; regionId?: string }

export class PDPCreatePPGTool implements LanguageModelTool<PDPCreatePPGToolInput> {
  constructor(private readonly ppgRepository: PrismaPostgresRepository) {}

  async invoke(options: LanguageModelToolInvocationOptions<PDPCreatePPGToolInput>, cancelToken: CancellationToken) {
    const workspaces = await this.ppgRepository.getWorkspaces()
    if (workspaces.length === 0) {
      return new LanguageModelToolResult([
        new LanguageModelTextPart(
          'User is not authenticated to any workspaces. Ask them to login. You can use the prisma-platform-login tool for this.',
        ),
      ])
    }
    if (workspaces.length > 1 && !options.input.workspaceId) {
      return new LanguageModelToolResult([
        new LanguageModelTextPart(
          `User is authenticated to multiple workspaces. Please specify the workspaceId to create the database in. Let the user choose one of the following workspaces and call this tool again with the corresponding workspaceId.`,
        ),
        new LanguageModelTextPart(`Available workspaces: ${JSON.stringify(workspaces)}`),
      ])
    }

    let workspace: Workspace | undefined
    if (options.input.workspaceId) {
      workspace = workspaces.find((w) => w.id === options.input.workspaceId)
    }

    if (workspaces.length === 1) {
      workspace = workspaces[0]
    }

    if (!workspace) {
      return new LanguageModelToolResult([new LanguageModelTextPart('Workspace not found. Please try again.')])
    }

    const regions = await this.ppgRepository.getRegions()
    if (!options.input.regionId) {
      return new LanguageModelToolResult([
        new LanguageModelTextPart('Region not specified. Please try again.'),
        new LanguageModelTextPart(`Available regions: ${JSON.stringify(regions)}`),
      ])
    }

    const toolResults = []
    try {
      const result = await this.ppgRepository.createProject({
        workspaceId: workspace.id,
        name: options.input.name,
        region: options.input.regionId,
        options: {},
      })

      toolResults.push(
        new LanguageModelTextPart(`Project ${result.project.name} created successfully.`),
        new LanguageModelTextPart(`Project info: ${JSON.stringify(result.project)}`),
      )

      if (result.database) {
        toolResults.push(
          new LanguageModelTextPart(
            `You can now connect to the database via the connection string: ${result.database.connectionString}`,
          ),
          new LanguageModelTextPart(`Database info: ${JSON.stringify(result.database)}`),
        )
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error)
      toolResults.push(
        new LanguageModelTextPart('Error creating project. Please try again.'),
        new LanguageModelTextPart('Error Details: ' + errorMessage),
      )
    }

    return new LanguageModelToolResult(toolResults)
  }

  prepareInvocation(
    options: LanguageModelToolInvocationPrepareOptions<PDPCreatePPGToolInput>,
    _token: CancellationToken,
  ): ProviderResult<PreparedToolInvocation> {
    return {
      invocationMessage: `Creating Prisma Postgres database ${options.input.name}...`,
    }
  }
}
