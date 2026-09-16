import { randomUUID } from 'node:crypto'
import { detect } from 'package-manager-detector/detect'
import { resolveCommand } from 'package-manager-detector/commands'
import { commands, tasks, Task, ShellExecution, TaskRevealKind, window, workspace, type WorkspaceFolder } from 'vscode'

const supportedAgents = ['npm', 'pnpm', 'pnpm@6', 'yarn', 'yarn@berry', 'bun'] as const

type SupportedAgent = (typeof supportedAgents)[number]

function isSupportedAgent(agent: string): agent is SupportedAgent {
  return supportedAgents.some((supported) => supported === agent)
}

async function runInstallTask(folder: WorkspaceFolder, command: string, args: string[]): Promise<number | undefined> {
  const installId = randomUUID()
  const task = new Task(
    { type: 'prisma-cli-install', installId },
    folder,
    'Install Prisma ORM 8 CLI',
    'Prisma',
    new ShellExecution(command, args, { cwd: folder.uri.fsPath }),
    [],
  )
  task.presentationOptions = { reveal: TaskRevealKind.Always, focus: true }

  let complete!: (exitCode: number | undefined) => void
  const completion = new Promise<number | undefined>((resolve) => {
    complete = resolve
  })
  // Subscribe before launching: a short-lived process may exit before executeTask resolves.
  const processEnd = tasks.onDidEndTaskProcess((event) => {
    if (event.execution.task.definition.installId === installId) complete(event.exitCode)
  })
  const taskEnd = tasks.onDidEndTask((event) => {
    // Covers cancellation or a task that never started a process. A process-end event, when
    // present, precedes this event and has already settled completion with the exit code.
    if (event.execution.task.definition.installId === installId) complete(undefined)
  })
  try {
    await tasks.executeTask(task)
    return await completion
  } finally {
    processEnd.dispose()
    taskEnd.dispose()
  }
}

export async function installPrismaCli(folder: WorkspaceFolder, isDisposed: () => boolean): Promise<void> {
  const canInstall = () => !isDisposed() && workspace.isTrusted && folder.uri.scheme === 'file'
  if (!canInstall()) return

  try {
    const detected = await detect({
      cwd: folder.uri.fsPath,
      stopDir: folder.uri.fsPath,
      strategies: ['packageManager-field', 'install-metadata', 'lockfile'],
    })
    if (!canInstall()) return

    let agent = detected?.agent
    if (!agent || !isSupportedAgent(agent)) {
      const selected = await window.showQuickPick(
        [
          { label: 'npm', agent: 'npm' as const },
          { label: 'pnpm', agent: 'pnpm' as const },
          { label: 'Yarn Classic', agent: 'yarn' as const },
          { label: 'Yarn (2 or later)', agent: 'yarn@berry' as const },
          { label: 'Bun', agent: 'bun' as const },
        ],
        { placeHolder: `Choose a package manager to install prisma@latest in "${folder.name}"` },
      )
      if (!selected) return
      agent = selected.agent
    }

    const args = ['-D', 'prisma@latest']
    // Installation targets the open root, including monorepo roots protected by these managers.
    if (agent === 'pnpm' || agent === 'pnpm@6' || agent === 'yarn') {
      args.push('--ignore-workspace-root-check')
    }
    const command = resolveCommand(agent, 'add', args)
    if (!command) throw new Error(`No add command available for ${agent}`)

    if (!canInstall()) return
    const exitCode = await runInstallTask(folder, command.command, command.args)
    if (exitCode !== 0) {
      throw new Error(`Prisma CLI install task did not succeed (exit code: ${exitCode ?? 'unknown'})`)
    }
  } catch (error) {
    console.error('Automatic Prisma ORM 8 CLI installation failed', error)
    if (canInstall()) {
      void window.showErrorMessage(
        `Automatic Prisma ORM 8 CLI installation failed in workspace "${folder.name}". Install "prisma@latest" manually.`,
      )
    }
    return
  }

  if (!canInstall()) return
  try {
    await commands.executeCommand('prisma.restartLanguageServer')
  } catch (error) {
    console.error('Prisma ORM 8 language server restart failed', error)
    if (canInstall()) {
      void window.showErrorMessage(
        `Prisma ORM 8 CLI was installed, but the language server could not restart.`,
      )
    }
  }
}
