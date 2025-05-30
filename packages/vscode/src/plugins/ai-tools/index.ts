import {
  CancellationToken,
  LanguageModelTextPart,
  LanguageModelTool,
  LanguageModelToolInvocationOptions,
  LanguageModelToolInvocationPrepareOptions,
  LanguageModelToolResult,
  lm,
  PreparedToolInvocation,
  ProviderResult,
} from 'vscode'
import { command } from 'execa'

import { PrismaVSCodePlugin } from '../types'

async function runCommand({ args, cwd, cancelToken }: { args: string[]; cwd: string; cancelToken: CancellationToken }) {
  const childProcess = command('npx -y prisma ' + args.join(' '), { cwd })
  cancelToken.onCancellationRequested(() => {
    childProcess.cancel()
  })
  const result = await childProcess
  return `${result.stdout}\n${result.stderr}`
}

type ToolProjectDirInput = {
  projectCwd: string
}

class MigrateStatusTool implements LanguageModelTool<ToolProjectDirInput> {
  async invoke(options: LanguageModelToolInvocationOptions<ToolProjectDirInput>, cancelToken: CancellationToken) {
    const result = await runCommand({
      args: ['migrate', 'status'],
      cwd: options.input.projectCwd,
      cancelToken,
    })
    return new LanguageModelToolResult([new LanguageModelTextPart(result)])
  }

  prepareInvocation(
    _options: LanguageModelToolInvocationPrepareOptions<ToolProjectDirInput>,
    _token: CancellationToken,
  ): ProviderResult<PreparedToolInvocation> {
    return {
      invocationMessage: 'Getting Prisma migrate status...',
    }
  }
}

type MigrateDevToolInput = ToolProjectDirInput & { name: string }

class MigrateDevTool implements LanguageModelTool<MigrateDevToolInput> {
  async invoke(options: LanguageModelToolInvocationOptions<MigrateDevToolInput>, cancelToken: CancellationToken) {
    const result = await runCommand({
      args: ['migrate', 'dev', '--name', options.input.name],
      cwd: options.input.projectCwd,
      cancelToken,
    })
    return new LanguageModelToolResult([new LanguageModelTextPart(result)])
  }

  prepareInvocation(
    options: LanguageModelToolInvocationPrepareOptions<MigrateDevToolInput>,
    _token: CancellationToken,
  ): ProviderResult<PreparedToolInvocation> {
    return {
      invocationMessage: `Running \`prisma migrate dev\` with name ${options.input.name}...`,
    }
  }
}

class MigrateResetTool implements LanguageModelTool<ToolProjectDirInput> {
  async invoke(options: LanguageModelToolInvocationOptions<ToolProjectDirInput>, cancelToken: CancellationToken) {
    const result = await runCommand({
      args: ['migrate', 'reset', '--force'],
      cwd: options.input.projectCwd,
      cancelToken,
    })
    return new LanguageModelToolResult([new LanguageModelTextPart(result)])
  }

  prepareInvocation(
    _options: LanguageModelToolInvocationPrepareOptions<ToolProjectDirInput>,
    _token: CancellationToken,
  ): ProviderResult<PreparedToolInvocation> {
    return {
      invocationMessage: 'Resetting database...',
    }
  }
}

class StudioTool implements LanguageModelTool<ToolProjectDirInput> {
  async invoke(options: LanguageModelToolInvocationOptions<ToolProjectDirInput>, cancelToken: CancellationToken) {
    const result = await runCommand({
      args: ['studio'],
      cwd: options.input.projectCwd,
      cancelToken,
    })
    return new LanguageModelToolResult([new LanguageModelTextPart(result)])
  }

  prepareInvocation(
    _options: LanguageModelToolInvocationPrepareOptions<ToolProjectDirInput>,
    _token: CancellationToken,
  ): ProviderResult<PreparedToolInvocation> {
    return {
      invocationMessage: 'Running Prisma Studio...',
    }
  }
}

const plugin: PrismaVSCodePlugin = {
  name: 'prisma-local-ai-tools',
  enabled: () => true,
  activate: (context) => {
    context.subscriptions.push(lm.registerTool('prisma-migrate-status', new MigrateStatusTool()))
    context.subscriptions.push(lm.registerTool('prisma-migrate-dev', new MigrateDevTool()))
    context.subscriptions.push(lm.registerTool('prisma-migrate-reset', new MigrateResetTool()))
    context.subscriptions.push(lm.registerTool('prisma-studio', new StudioTool()))
  },
  deactivate: () => {},
}

export default plugin
