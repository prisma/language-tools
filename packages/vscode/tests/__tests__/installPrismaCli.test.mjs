import path from 'node:path'
import os from 'node:os'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  showQuickPick: vi.fn(),
  showErrorMessage: vi.fn(),
  executeTask: vi.fn(),
  executeCommand: vi.fn(),
  runCommand: vi.fn(),
  processEndListeners: new Set(),
  taskEndListeners: new Set(),
  workspace: { isTrusted: true },
}))

vi.mock('vscode', () => ({
  window: {
    showQuickPick: mocks.showQuickPick,
    showErrorMessage: mocks.showErrorMessage,
  },
  workspace: mocks.workspace,
  commands: { executeCommand: mocks.executeCommand },
  tasks: {
    executeTask: mocks.executeTask,
    onDidEndTaskProcess: (listener) => {
      mocks.processEndListeners.add(listener)
      return { dispose: () => mocks.processEndListeners.delete(listener) }
    },
    onDidEndTask: (listener) => {
      mocks.taskEndListeners.add(listener)
      return { dispose: () => mocks.taskEndListeners.delete(listener) }
    },
  },
  Task: class {
    constructor(definition, scope, name, source, execution) {
      Object.assign(this, { definition, scope, name, source, execution })
    }
  },
  ShellExecution: class {
    constructor(command, args, options) {
      Object.assign(this, { command, args, options })
      mocks.runCommand([command, ...args].join(' '))
    }
  },
  TaskRevealKind: { Always: 1 },
}))

import { installPrismaCli } from '../../src/plugins/prisma-language-server/installPrismaCli'

let parent
let folder

beforeEach(async () => {
  vi.resetAllMocks()
  mocks.workspace.isTrusted = true
  parent = await mkdtemp(path.join(os.tmpdir(), 'prisma-cli-install-'))
  const root = path.join(parent, 'my project')
  await mkdir(root)
  folder = { name: 'my-project', uri: { scheme: 'file', fsPath: root } }
  mocks.processEndListeners.clear()
  mocks.taskEndListeners.clear()
  mocks.executeTask.mockImplementation(async (task) => {
    const execution = { task }
    for (const listener of mocks.processEndListeners) listener({ execution, exitCode: 0 })
    for (const listener of mocks.taskEndListeners) listener({ execution })
    return execution
  })
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(parent, { recursive: true, force: true })
})

async function setFile(filename, content) {
  const target = path.join(folder.uri.fsPath, filename)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, content)
}

describe('Prisma CLI installation with package-manager-detector', () => {
  it.each([
    ['npm@10.0.0', 'npm i -D prisma@latest'],
    ['pnpm@10.0.0', 'pnpm add -D prisma@latest --ignore-workspace-root-check'],
    ['pnpm@6.0.0', 'pnpm add -D prisma@latest --ignore-workspace-root-check'],
    ['yarn@1.22.0', 'yarn add -D prisma@latest --ignore-workspace-root-check'],
    ['yarn@4.0.0', 'yarn add -D prisma@latest'],
    ['bun@1.0.0', 'bun add -D prisma@latest'],
  ])('prefers packageManager %s over conflicting lockfiles', async (packageManager, command) => {
    await setFile('package.json', JSON.stringify({ packageManager }))
    await setFile('pnpm-lock.yaml', '')
    await setFile('package-lock.json', '{}')
    await installPrismaCli(folder, () => false)

    expect(mocks.runCommand).toHaveBeenCalledWith(command)
    expect(mocks.executeTask).toHaveBeenCalledOnce()
    const task = mocks.executeTask.mock.calls[0][0]
    expect(task.scope).toBe(folder)
    expect(task.execution.options.cwd).toBe(folder.uri.fsPath)
    expect(task.presentationOptions).toEqual({ reveal: 1, focus: true })
    expect(mocks.showQuickPick).not.toHaveBeenCalled()
  })

  it.each([
    ['package-lock.json', 'npm i -D prisma@latest'],
    ['npm-shrinkwrap.json', 'npm i -D prisma@latest'],
    ['pnpm-lock.yaml', 'pnpm add -D prisma@latest --ignore-workspace-root-check'],
    ['yarn.lock', 'yarn add -D prisma@latest --ignore-workspace-root-check'],
    ['bun.lock', 'bun add -D prisma@latest'],
    ['bun.lockb', 'bun add -D prisma@latest'],
  ])('detects %s', async (filename, command) => {
    await setFile(filename, '')
    await installPrismaCli(folder, () => false)
    expect(mocks.runCommand).toHaveBeenCalledWith(command)
  })

  it('recognizes modern Yarn installation metadata before the lockfile', async () => {
    await setFile('node_modules/.yarn-state.yml', '')
    await setFile('yarn.lock', '')
    await installPrismaCli(folder, () => false)
    expect(mocks.runCommand).toHaveBeenCalledWith('yarn add -D prisma@latest')
  })

  it('does not detect package managers outside the workspace root', async () => {
    await writeFile(path.join(parent, 'package.json'), '{"packageManager":"pnpm@10.0.0"}')
    mocks.showQuickPick.mockResolvedValue({ label: 'npm', agent: 'npm' })
    await installPrismaCli(folder, () => false)
    expect(mocks.showQuickPick).toHaveBeenCalledOnce()
    expect(mocks.runCommand).toHaveBeenCalledWith('npm i -D prisma@latest')
  })

  it.each(['deno@2.0.0', 'npm; malicious-command'])(
    'asks for a supported manager instead of executing %s',
    async (packageManager) => {
      await setFile('package.json', JSON.stringify({ packageManager }))
      await installPrismaCli(folder, () => false)
      expect(mocks.showQuickPick).toHaveBeenCalledOnce()
      expect(mocks.executeTask).not.toHaveBeenCalled()
    },
  )

  it('does not install if the package manager picker is dismissed', async () => {
    await installPrismaCli(folder, () => false)
    expect(mocks.showQuickPick).toHaveBeenCalledOnce()
    expect(mocks.executeTask).not.toHaveBeenCalled()
  })

  it('restarts after successful installation even if the process exits before executeTask resolves', async () => {
    await setFile('package-lock.json', '{}')
    await installPrismaCli(folder, () => false)
    expect(mocks.executeCommand).toHaveBeenCalledOnce()
    expect(mocks.executeCommand).toHaveBeenCalledWith('prisma.restartLanguageServer')
    expect(mocks.showErrorMessage).not.toHaveBeenCalled()
    expect(mocks.processEndListeners.size).toBe(0)
    expect(mocks.taskEndListeners.size).toBe(0)
  })

  it.each([1, undefined])('does not restart when the install exits with %s', async (exitCode) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await setFile('package-lock.json', '{}')
    mocks.executeTask.mockImplementation(async (task) => {
      const execution = { task }
      for (const listener of mocks.processEndListeners) listener({ execution, exitCode })
      for (const listener of mocks.taskEndListeners) listener({ execution })
      return execution
    })
    await installPrismaCli(folder, () => false)
    expect(mocks.executeCommand).not.toHaveBeenCalled()
    expect(mocks.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Install "prisma@latest" manually'))
    expect(mocks.processEndListeners.size).toBe(0)
    expect(mocks.taskEndListeners.size).toBe(0)
  })

  it('cleans up without restarting if the task ends without a process', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await setFile('package-lock.json', '{}')
    mocks.executeTask.mockImplementation(async (task) => {
      const execution = { task }
      for (const listener of mocks.taskEndListeners) listener({ execution })
      return execution
    })
    await installPrismaCli(folder, () => false)
    expect(mocks.executeCommand).not.toHaveBeenCalled()
    expect(mocks.processEndListeners.size).toBe(0)
    expect(mocks.taskEndListeners.size).toBe(0)
  })

  it('ignores other tasks and waits for its own installation to finish', async () => {
    await setFile('package-lock.json', '{}')
    mocks.executeTask.mockImplementation(async (task) => ({ task }))
    const installing = installPrismaCli(folder, () => false)
    await vi.waitFor(() => expect(mocks.executeTask).toHaveBeenCalledOnce())
    const unrelated = { task: { definition: { installId: 'other' } } }
    for (const listener of mocks.processEndListeners) listener({ execution: unrelated, exitCode: 0 })
    for (const listener of mocks.taskEndListeners) listener({ execution: unrelated })
    await new Promise((resolve) => setImmediate(resolve))
    expect(mocks.executeCommand).not.toHaveBeenCalled()

    const execution = { task: mocks.executeTask.mock.calls[0][0] }
    for (const listener of mocks.processEndListeners) listener({ execution, exitCode: 0 })
    for (const listener of mocks.taskEndListeners) listener({ execution })
    await installing
    expect(mocks.executeCommand).toHaveBeenCalledOnce()
    expect(mocks.executeCommand).toHaveBeenCalledWith('prisma.restartLanguageServer')
  })

  it.each(['trust', 'disposal'])('rechecks %s after successful installation', async (change) => {
    await setFile('package-lock.json', '{}')
    let disposed = false
    mocks.executeTask.mockImplementation(async (task) => {
      if (change === 'trust') mocks.workspace.isTrusted = false
      else disposed = true
      const execution = { task }
      for (const listener of mocks.processEndListeners) listener({ execution, exitCode: 0 })
      return execution
    })
    await installPrismaCli(folder, () => disposed)
    expect(mocks.executeCommand).not.toHaveBeenCalled()
    expect(mocks.processEndListeners.size).toBe(0)
    expect(mocks.taskEndListeners.size).toBe(0)
  })

  it('reports restart failure without asking the user to retry', async () => {
    await setFile('package-lock.json', '{}')
    mocks.executeCommand.mockRejectedValue(new Error('Restart failed'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await installPrismaCli(folder, () => false)
    expect(mocks.showErrorMessage).toHaveBeenCalledOnce()
    const message = mocks.showErrorMessage.mock.calls[0][0]
    expect(message).toContain('CLI was installed')
    expect(message).not.toContain('Prisma: Restart Language Server')
    expect(message).not.toContain('Install "prisma@latest" manually')
  })

  it('reports task launch failures and cleans up listeners', async () => {
    await setFile('package-lock.json', '{}')
    mocks.executeTask.mockRejectedValue(new Error('Task unavailable'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await installPrismaCli(folder, () => false)
    expect(mocks.showErrorMessage).toHaveBeenCalledOnce()
    expect(mocks.executeCommand).not.toHaveBeenCalled()
    expect(mocks.processEndListeners.size).toBe(0)
    expect(mocks.taskEndListeners.size).toBe(0)
  })

  it('does not install in an untrusted workspace', async () => {
    mocks.workspace.isTrusted = false
    await installPrismaCli(folder, () => false)
    expect(mocks.showQuickPick).not.toHaveBeenCalled()
    expect(mocks.executeTask).not.toHaveBeenCalled()
  })

  it('does not install after disposal', async () => {
    await installPrismaCli(folder, () => true)
    expect(mocks.executeTask).not.toHaveBeenCalled()
  })

  it.each(['trust', 'disposal'])('rechecks %s after the package manager picker', async (change) => {
    let disposed = false
    mocks.showQuickPick.mockImplementation(async () => {
      if (change === 'trust') mocks.workspace.isTrusted = false
      else disposed = true
      return { label: 'npm', agent: 'npm' }
    })
    await installPrismaCli(folder, () => disposed)
    expect(mocks.executeTask).not.toHaveBeenCalled()
  })
})
