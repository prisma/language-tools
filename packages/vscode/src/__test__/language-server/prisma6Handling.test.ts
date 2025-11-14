/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as vscode from 'vscode'
import * as assert from 'assert'
import * as sinon from 'sinon'
import { handleDiagnostic } from '../../prisma6Handling'

const prisma6MissingDatasourceUrlMessage = 'Argument "url" is missing in data source block "db".'
const prisma7UnexpectedDatasourceUrlMessage = 'The datasource property `url` is no longer supported in schema files.'
const pinToPrisma6Button = 'Pin this workspace to Prisma 6'
const unpinFromPrisma6Button = 'Unpin this workspace from Prisma 6'
const doNotAskAgainButton = 'Do not ask me again'

suite('Prisma 6 Handling Tests', () => {
  let showInformationMessageStub: sinon.SinonStub
  let executeCommandStub: sinon.SinonStub
  let getConfigurationStub: sinon.SinonStub
  let configGetStub: sinon.SinonStub
  let configUpdateStub: sinon.SinonStub
  let mockContext: vscode.ExtensionContext
  let workspaceStateGetStub: sinon.SinonStub
  let workspaceStateUpdateStub: sinon.SinonStub

  setup(() => {
    // Create stubs for VS Code APIs
    showInformationMessageStub = sinon.stub(vscode.window, 'showInformationMessage')
    executeCommandStub = sinon.stub(vscode.commands, 'executeCommand')
    getConfigurationStub = sinon.stub(vscode.workspace, 'getConfiguration')

    configGetStub = sinon.stub()
    configUpdateStub = sinon.stub()
    workspaceStateGetStub = sinon.stub()
    workspaceStateUpdateStub = sinon.stub()

    const mockConfig = {
      get: configGetStub,
      update: configUpdateStub,
    }
    getConfigurationStub.withArgs('prisma').returns(mockConfig)

    mockContext = {
      workspaceState: {
        get: workspaceStateGetStub,
        update: workspaceStateUpdateStub,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any

    // Default behavior
    configGetStub.returns(false)
    configUpdateStub.resolves()
    executeCommandStub.resolves()
    showInformationMessageStub.resolves(undefined)
    workspaceStateGetStub.withArgs('wasPrisma6PromptShown', false).returns(false)
    workspaceStateUpdateStub.resolves()
  })

  teardown(() => {
    sinon.restore()
  })

  suite('Prisma 6 Missing Datasource URL', () => {
    test('shows unpin prompt when pinned to Prisma 6 and prompts not hidden', async () => {
      configGetStub.withArgs('pinToPrisma6').returns(true)
      configGetStub.withArgs('hidePrisma6Prompts').returns(false)
      showInformationMessageStub.resolves(unpinFromPrisma6Button)

      await handleDiagnostic(prisma6MissingDatasourceUrlMessage, mockContext)

      sinon.assert.calledOnce(showInformationMessageStub)
      const [, button1, button2] = showInformationMessageStub.firstCall.args
      assert.strictEqual(button1, unpinFromPrisma6Button)
      assert.strictEqual(button2, doNotAskAgainButton)

      sinon.assert.calledOnceWithExactly(executeCommandStub, 'prisma.unpinWorkspaceFromPrisma6')
      sinon.assert.calledOnceWithExactly(workspaceStateUpdateStub, 'wasPrisma6PromptShown', true)
    })

    test('updates config when "Do not ask me again" is selected', async () => {
      configGetStub.withArgs('pinToPrisma6').returns(true)
      configGetStub.withArgs('hidePrisma6Prompts').returns(false)
      showInformationMessageStub.resolves(doNotAskAgainButton)

      await handleDiagnostic(prisma6MissingDatasourceUrlMessage, mockContext)

      sinon.assert.calledOnceWithExactly(configUpdateStub, 'hidePrisma6Prompts', true, true)
      sinon.assert.notCalled(executeCommandStub)
      sinon.assert.calledOnceWithExactly(workspaceStateUpdateStub, 'wasPrisma6PromptShown', true)
    })

    test('does not show prompt when not pinned to Prisma 6', async () => {
      configGetStub.withArgs('pinToPrisma6').returns(false)
      configGetStub.withArgs('hidePrisma6Prompts').returns(false)

      await handleDiagnostic(prisma6MissingDatasourceUrlMessage, mockContext)

      sinon.assert.notCalled(showInformationMessageStub)
      sinon.assert.notCalled(workspaceStateUpdateStub)
    })

    test('does not show prompt when pinToPrisma6 is undefined', async () => {
      configGetStub.withArgs('pinToPrisma6').returns(undefined)
      configGetStub.withArgs('hidePrisma6Prompts').returns(undefined)

      await handleDiagnostic(prisma6MissingDatasourceUrlMessage, mockContext)

      sinon.assert.notCalled(showInformationMessageStub)
      sinon.assert.notCalled(workspaceStateUpdateStub)
    })

    test('does not show prompt when prompts are hidden', async () => {
      configGetStub.withArgs('pinToPrisma6').returns(true)
      configGetStub.withArgs('hidePrisma6Prompts').returns(true)

      await handleDiagnostic(prisma6MissingDatasourceUrlMessage, mockContext)

      sinon.assert.notCalled(showInformationMessageStub)
      sinon.assert.notCalled(workspaceStateUpdateStub)
    })

    test('does not show prompt when already shown (workspace state)', async () => {
      configGetStub.withArgs('pinToPrisma6').returns(true)
      configGetStub.withArgs('hidePrisma6Prompts').returns(false)
      workspaceStateGetStub.withArgs('wasPrisma6PromptShown', false).returns(true)

      await handleDiagnostic(prisma6MissingDatasourceUrlMessage, mockContext)

      sinon.assert.notCalled(showInformationMessageStub)
      sinon.assert.notCalled(workspaceStateUpdateStub)
    })

    test('does nothing when user dismisses prompt', async () => {
      configGetStub.withArgs('pinToPrisma6').returns(true)
      configGetStub.withArgs('hidePrisma6Prompts').returns(false)
      showInformationMessageStub.resolves(undefined)

      await handleDiagnostic(prisma6MissingDatasourceUrlMessage, mockContext)

      sinon.assert.notCalled(executeCommandStub)
      sinon.assert.notCalled(configUpdateStub)
      sinon.assert.calledOnceWithExactly(workspaceStateUpdateStub, 'wasPrisma6PromptShown', true)
    })
  })

  suite('Prisma 7 Unexpected Datasource URL', () => {
    test('shows pin prompt for Prisma 7 message', async () => {
      configGetStub.withArgs('hidePrisma6Prompts').returns(false)
      showInformationMessageStub.resolves(pinToPrisma6Button)

      await handleDiagnostic(prisma7UnexpectedDatasourceUrlMessage, mockContext)

      sinon.assert.calledOnce(showInformationMessageStub)
      const [, button1, button2] = showInformationMessageStub.firstCall.args
      assert.strictEqual(button1, pinToPrisma6Button)
      assert.strictEqual(button2, doNotAskAgainButton)

      sinon.assert.calledOnceWithExactly(executeCommandStub, 'prisma.pinWorkspaceToPrisma6')
      sinon.assert.calledOnceWithExactly(workspaceStateUpdateStub, 'wasPrisma6PromptShown', true)
    })

    test('updates config when "Do not ask me again" is selected', async () => {
      configGetStub.withArgs('hidePrisma6Prompts').returns(false)
      showInformationMessageStub.resolves(doNotAskAgainButton)

      await handleDiagnostic(prisma7UnexpectedDatasourceUrlMessage, mockContext)

      sinon.assert.calledOnceWithExactly(configUpdateStub, 'hidePrisma6Prompts', true, true)
      sinon.assert.notCalled(executeCommandStub)
      sinon.assert.calledOnceWithExactly(workspaceStateUpdateStub, 'wasPrisma6PromptShown', true)
    })

    test('does not show prompt when prompts are hidden', async () => {
      configGetStub.withArgs('hidePrisma6Prompts').returns(true)

      await handleDiagnostic(prisma7UnexpectedDatasourceUrlMessage, mockContext)

      sinon.assert.notCalled(showInformationMessageStub)
      sinon.assert.notCalled(workspaceStateUpdateStub)
    })

    test('does not show prompt when already shown (workspace state)', async () => {
      configGetStub.withArgs('hidePrisma6Prompts').returns(false)
      workspaceStateGetStub.withArgs('wasPrisma6PromptShown', false).returns(true)

      await handleDiagnostic(prisma7UnexpectedDatasourceUrlMessage, mockContext)

      sinon.assert.notCalled(showInformationMessageStub)
      sinon.assert.notCalled(workspaceStateUpdateStub)
    })

    test('does nothing when user dismisses prompt', async () => {
      configGetStub.withArgs('hidePrisma6Prompts').returns(false)
      showInformationMessageStub.resolves(undefined)

      await handleDiagnostic(prisma7UnexpectedDatasourceUrlMessage, mockContext)

      sinon.assert.notCalled(executeCommandStub)
      sinon.assert.notCalled(configUpdateStub)
      sinon.assert.calledOnceWithExactly(workspaceStateUpdateStub, 'wasPrisma6PromptShown', true)
    })
  })

  suite('Message Pattern Matching', () => {
    test('correctly identifies Prisma 6 missing datasource URL message', async () => {
      configGetStub.withArgs('pinToPrisma6').returns(true)
      configGetStub.withArgs('hidePrisma6Prompts').returns(false)

      await handleDiagnostic(prisma6MissingDatasourceUrlMessage, mockContext)

      sinon.assert.calledOnce(showInformationMessageStub)
    })

    test('correctly identifies Prisma 7 unexpected datasource URL message', async () => {
      configGetStub.withArgs('hidePrisma6Prompts').returns(false)

      await handleDiagnostic(prisma7UnexpectedDatasourceUrlMessage, mockContext)

      sinon.assert.calledOnce(showInformationMessageStub)
    })

    test('does not show prompt for unrelated diagnostic messages', async () => {
      configGetStub.withArgs('pinToPrisma6').returns(true)
      configGetStub.withArgs('hidePrisma6Prompts').returns(false)

      await handleDiagnostic('Some other error message that is not related to Prisma 6 or 7.', mockContext)

      sinon.assert.notCalled(showInformationMessageStub)
    })
  })
})
