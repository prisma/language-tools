import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  stat: vi.fn(),
  installPrismaCli: vi.fn(),
  showWarningMessage: vi.fn(),
  getWorkspaceFolder: vi.fn(),
  start: vi.fn(),
  onReady: vi.fn(),
  stop: vi.fn(),
}))

vi.mock('../../src/plugins/prisma-language-server/installPrismaCli', () => ({
  installPrismaCli: mocks.installPrismaCli,
}))
vi.mock('node:fs/promises', () => ({ stat: mocks.stat }))
vi.mock('vscode', () => ({
  window: { showWarningMessage: mocks.showWarningMessage },
  workspace: { isTrusted: true, getWorkspaceFolder: mocks.getWorkspaceFolder },
}))
vi.mock('vscode-languageclient', () => ({ CloseAction: { DoNotRestart: 1 }, ErrorAction: { Shutdown: 1 } }))
vi.mock('vscode-languageclient/node', () => ({
  LanguageClient: class {
    start = mocks.start
    onReady = mocks.onReady
    stop = mocks.stop
  },
}))

import { PrismaNextClients } from '../../src/plugins/prisma-language-server/prismaNextClients'

const folder = {
  name: 'my-project',
  uri: { scheme: 'file', fsPath: '/my-project', toString: () => 'file:///my-project' },
}
const document = { uri: { scheme: 'file' } }

// Flush the asynchronous filesystem check and client startup without real timers.
async function ensureClient(clients) {
  clients.ensureClientFor(document)
  await vi.waitFor(() => expect(mocks.stat).toHaveBeenCalled())
  await new Promise((resolve) => setImmediate(resolve))
}

describe('missing Prisma Next CLI warning', () => {
  let clients

  beforeEach(() => {
    vi.resetAllMocks()
    mocks.getWorkspaceFolder.mockReturnValue(folder)
    mocks.stat.mockRejectedValue(Object.assign(new Error('Missing CLI'), { code: 'ENOENT' }))
    clients = new PrismaNextClients(vi.fn())
  })

  afterEach(async () => {
    await clients.dispose()
    vi.restoreAllMocks()
  })

  it('shows installation guidance when the CLI is missing', async () => {
    await ensureClient(clients)

    expect(mocks.showWarningMessage).toHaveBeenCalledOnce()
    const [message] = mocks.showWarningMessage.mock.calls[0]
    expect(message).toContain('my-project')
    expect(message).toContain('Prisma ORM 8 CLI is required for autocomplete, formatting, and error checking')
    expect(mocks.showWarningMessage.mock.calls[0][1]).toEqual({ modal: true })
    expect(mocks.showWarningMessage.mock.calls[0][3]).toEqual({
      title: 'Continue without language features',
      isCloseAffordance: true,
    })
    expect(message).not.toContain('Next')
    expect(message).not.toContain('manually')
    expect(message).not.toContain('Prisma: Restart Language Server')
    expect(mocks.start).not.toHaveBeenCalled()
  })

  it('offers installation and invokes the installer when selected', async () => {
    mocks.showWarningMessage.mockImplementation(async (_message, _options, installAction) => installAction)
    await ensureClient(clients)

    expect(mocks.showWarningMessage.mock.calls[0][2]).toEqual({ title: 'Install prisma@latest' })
    expect(mocks.installPrismaCli).toHaveBeenCalledWith(folder, expect.any(Function))
    const isDisposed = mocks.installPrismaCli.mock.calls[0][1]
    expect(isDisposed()).toBe(false)
    await clients.dispose()
    expect(isDisposed()).toBe(true)
  })

  it('does not install when continuing without language features', async () => {
    mocks.showWarningMessage.mockImplementation(
      async (_message, _options, _installAction, continueAction) => continueAction,
    )
    await ensureClient(clients)
    expect(mocks.installPrismaCli).not.toHaveBeenCalled()
  })

  it('does not install when the warning is dismissed', async () => {
    await ensureClient(clients)
    expect(mocks.installPrismaCli).not.toHaveBeenCalled()
  })

  it('does not repeat the warning on automatic retries but permits an explicit restart', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(0)
    await ensureClient(clients)
    now.mockReturnValue(30_000)
    await ensureClient(clients)

    expect(mocks.stat).toHaveBeenCalledTimes(2)
    expect(mocks.showWarningMessage).toHaveBeenCalledOnce()

    await clients.stopAll()
    await ensureClient(clients)
    expect(mocks.showWarningMessage).toHaveBeenCalledTimes(2)
  })

  it('starts without a warning when the CLI exists', async () => {
    mocks.stat.mockResolvedValue({ isFile: () => true })
    await ensureClient(clients)

    expect(mocks.start).toHaveBeenCalledOnce()
    expect(mocks.showWarningMessage).not.toHaveBeenCalled()
  })

  it('does not notify after disposal while the filesystem check is pending', async () => {
    let finishStat
    mocks.stat.mockReturnValue(
      new Promise((resolve) => {
        finishStat = resolve
      }),
    )
    clients.ensureClientFor(document)
    const disposed = clients.dispose()
    finishStat({ isFile: () => false })
    await disposed

    expect(mocks.showWarningMessage).not.toHaveBeenCalled()
  })
})
