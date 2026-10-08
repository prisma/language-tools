import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  showErrorMessage: vi.fn(),
  showTextDocument: vi.fn(),
}))

vi.mock('vscode', () => ({
  window: { showErrorMessage: mocks.showErrorMessage, showTextDocument: mocks.showTextDocument },
  workspace: { asRelativePath: (uri) => uri.toString().replace('file:///my-project/', '') },
}))

import { createConfigLoadFailureHandler } from '../../src/plugins/prisma-language-server/prismaConfigLoadFailure'

const configUri = { toString: () => 'file:///my-project/apps/api/prisma.config.ts' }
const otherConfigUri = { toString: () => 'file:///my-project/apps/web/prisma.config.ts' }
const loadFailure = (message = 'Malformed authoring pslBlock contribution') => ({
  code: 'PRISMA_CONFIG_LOAD_FAILED',
  message,
})

const flush = () => new Promise((resolve) => setImmediate(resolve))

describe('Prisma config load failure notification', () => {
  let handle

  beforeEach(() => {
    vi.resetAllMocks()
    mocks.showErrorMessage.mockResolvedValue(undefined)
    handle = createConfigLoadFailureHandler()
  })

  it('reports a config that failed to load', () => {
    handle(configUri, [loadFailure()])

    expect(mocks.showErrorMessage).toHaveBeenCalledOnce()
    const [message, action] = mocks.showErrorMessage.mock.calls[0]
    expect(message).toContain('"apps/api/prisma.config.ts"')
    expect(message).toContain('Formatting and other language features are unavailable')
    expect(action).toBe('Open config')
  })

  it('recognizes a diagnostic code with a target', () => {
    handle(configUri, [{ code: { value: 'PRISMA_CONFIG_LOAD_FAILED', target: {} }, message: 'failed' }])

    expect(mocks.showErrorMessage).toHaveBeenCalledOnce()
  })

  it('ignores other diagnostics', () => {
    handle(configUri, [{ code: 'PSL_PARSE_ERROR', message: 'Unexpected token' }, { message: 'No code' }])

    expect(mocks.showErrorMessage).not.toHaveBeenCalled()
  })

  it('does not repeat the notification when the same failure is published again', () => {
    handle(configUri, [loadFailure()])
    handle(configUri, [loadFailure()])
    handle(configUri, [loadFailure()])

    expect(mocks.showErrorMessage).toHaveBeenCalledOnce()
  })

  it('reports again when the failure message changes', () => {
    handle(configUri, [loadFailure('first')])
    handle(configUri, [loadFailure('second')])

    expect(mocks.showErrorMessage).toHaveBeenCalledTimes(2)
  })

  it('reports again after the failure cleared', () => {
    handle(configUri, [loadFailure()])
    handle(configUri, [])
    handle(configUri, [loadFailure()])

    expect(mocks.showErrorMessage).toHaveBeenCalledTimes(2)
  })

  it('reports each config file separately', () => {
    handle(configUri, [loadFailure()])
    handle(otherConfigUri, [loadFailure()])

    expect(mocks.showErrorMessage).toHaveBeenCalledTimes(2)
  })

  it('opens the config when the action is selected', async () => {
    mocks.showErrorMessage.mockResolvedValue('Open config')
    handle(configUri, [loadFailure()])
    await flush()

    expect(mocks.showTextDocument).toHaveBeenCalledWith(configUri)
  })

  it('does not open the config when the notification is dismissed', async () => {
    handle(configUri, [loadFailure()])
    await flush()

    expect(mocks.showTextDocument).not.toHaveBeenCalled()
  })
})
