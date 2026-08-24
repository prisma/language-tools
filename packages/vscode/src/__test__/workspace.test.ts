import assert from 'node:assert'
import { stat } from 'node:fs/promises'
import vscode from 'vscode'
import type { DocumentOwner } from '../plugins/prisma-language-server/documentOwnership'
import type { DocumentRoutingEvent } from '../plugins/prisma-language-server/documentRouting'
import {
  languageServerTestStateCommand,
  type LanguageServerTestState,
} from '../plugins/prisma-language-server/languageServerTestState'
import { getPrismaCliEntrypoint, getWorkspaceDocUri, getWorkspaceFolder, sleep } from './helper'

const stateTimeoutMs = 30_000
const diagnosticTimeoutMs = 20_000

suite('Multi-root integration workspace', () => {
  test('resolves documents and real Prisma CLI entrypoints per workspace root', async () => {
    const rootA = getWorkspaceFolder('integration-root-a')
    const rootB = getWorkspaceFolder('integration-root-b')
    const missingRoot = getWorkspaceFolder('integration-root-missing')

    const documentAUri = getWorkspaceDocUri(rootA, 'schema.prisma')
    const documentBUri = getWorkspaceDocUri(rootB, 'schema.prisma')
    const missingDocumentUri = getWorkspaceDocUri(missingRoot, 'schema.prisma')

    assert.strictEqual(vscode.workspace.getWorkspaceFolder(documentAUri), rootA)
    assert.strictEqual(vscode.workspace.getWorkspaceFolder(documentBUri), rootB)
    assert.strictEqual(vscode.workspace.getWorkspaceFolder(missingDocumentUri), missingRoot)
    assert.notStrictEqual(rootA.uri.toString(), rootB.uri.toString())

    for (const workspaceFolder of [rootA, rootB]) {
      const entrypoint = getPrismaCliEntrypoint(workspaceFolder)
      assert.strictEqual(
        (await stat(entrypoint.fsPath)).isFile(),
        true,
        `Missing Prisma CLI entrypoint: ${entrypoint.fsPath}`,
      )
    }

    await assert.rejects(stat(getPrismaCliEntrypoint(missingRoot).fsPath), { code: 'ENOENT' })
  })

  test('routes unsaved documents exclusively across real root-local clients', async () => {
    const rootA = getWorkspaceFolder('integration-root-a')
    const rootB = getWorkspaceFolder('integration-root-b')
    const missingRoot = getWorkspaceFolder('integration-root-missing')
    const fixtures = await snapshotFixtures([
      getWorkspaceDocUri(rootA, 'schema.prisma'),
      getWorkspaceDocUri(rootA, 'second.prisma'),
      getWorkspaceDocUri(rootB, 'schema.prisma'),
      getWorkspaceDocUri(missingRoot, 'schema.prisma'),
    ])

    try {
      const extension = vscode.extensions.getExtension('Prisma.prisma')
      assert.ok(extension)
      await extension.activate()
      const activationState = await getTestState()
      assert.deepStrictEqual(activationState.localClients.startedWorkspaceFolderUris, [])
      assert.deepStrictEqual(activationState.localClients.startCountsByWorkspaceFolderUri, {})

      const documentA = await vscode.workspace.openTextDocument(fixtures[0].uri)
      const secondDocumentA = await vscode.workspace.openTextDocument(fixtures[1].uri)
      const documentB = await vscode.workspace.openTextDocument(fixtures[2].uri)
      const missingDocument = await vscode.workspace.openTextDocument(fixtures[3].uri)

      const initialState = await waitForState(
        (state) =>
          state.localClients.startedWorkspaceFolderUris.length === 0 &&
          [documentA, secondDocumentA, documentB, missingDocument].every((document) =>
            activeOwnerKeys(state, document.uri).has('bundled'),
          ),
        'unmarked documents to be owned by the bundled client without starting local clients',
      )
      assert.strictEqual(initialState.workspaceTrusted, true)
      assert.deepStrictEqual(initialState.localClients.startCountsByWorkspaceFolderUri, {})
      assertExclusiveOwners(initialState)

      const invalidSchema = withDocumentEol(documentA, 'model Broken {\n  id Missing\n}\n')
      await replaceDocument(documentA, invalidSchema)
      await waitForDiagnostics(
        documentA.uri,
        (diagnostics) => diagnostics.length > 0,
        'bundled diagnostics before adding the directive',
      )

      const markedInvalidSchema = withDocumentEol(documentA, `// use prisma-next\n${invalidSchema}`)
      const addDirectiveEventIndex = initialState.routingEvents.length
      await replaceDocument(documentA, markedInvalidSchema)
      const localAState = await waitForState(
        (state) =>
          state.localClients.startCountsByWorkspaceFolderUri[rootA.uri.toString()] === 1 &&
          lastOpenedAfter(state, documentA.uri, addDirectiveEventIndex)?.owner.kind === 'local',
        'root A local client and marked document synchronization',
      )
      assert.strictEqual(
        localAState.localClients.startCountsByWorkspaceFolderUri[rootA.uri.toString()],
        1,
        'expected the real root A client to complete its initialization handshake',
      )
      const localAOpen = lastOpenedAfter(localAState, documentA.uri, addDirectiveEventIndex)
      assert.ok(localAOpen)
      assert.strictEqual(localAOpen.documentText, markedInvalidSchema)
      assert.strictEqual(localAOpen.documentVersion, documentA.version)
      assert.deepStrictEqual(
        activeOwnerKeys(localAState, documentA.uri),
        new Set([localOwnerKey(rootA.uri.toString())]),
      )
      assert.strictEqual(
        hasDiagnosticClearAfter(localAState, documentA.uri, 'bundled', addDirectiveEventIndex),
        true,
        'expected bundled diagnostics to clear before local ownership',
      )
      assertExclusiveOwners(localAState)

      const markedSecondSchema = withDocumentEol(
        secondDocumentA,
        '// use prisma-next\nmodel RootASecondRecord {\n  id Int @id\n}\n',
      )
      const secondAEventIndex = localAState.routingEvents.length
      await replaceDocument(secondDocumentA, markedSecondSchema)
      const reusedAState = await waitForState(
        (state) => lastOpenedAfter(state, secondDocumentA.uri, secondAEventIndex)?.owner.kind === 'local',
        'second root A document to synchronize locally',
      )
      assert.strictEqual(reusedAState.localClients.startCountsByWorkspaceFolderUri[rootA.uri.toString()], 1)
      assert.deepStrictEqual(
        activeOwnerKeys(reusedAState, secondDocumentA.uri),
        new Set([localOwnerKey(rootA.uri.toString())]),
      )
      assertExclusiveOwners(reusedAState)

      const markedRootBSchema = withDocumentEol(documentB, '// use prisma-next\nmodel RootBRecord {\n  id Int @id\n}\n')
      const rootBEventIndex = reusedAState.routingEvents.length
      await replaceDocument(documentB, markedRootBSchema)
      const independentRootsState = await waitForState(
        (state) =>
          state.localClients.startCountsByWorkspaceFolderUri[rootA.uri.toString()] === 1 &&
          state.localClients.startCountsByWorkspaceFolderUri[rootB.uri.toString()] === 1 &&
          lastOpenedAfter(state, documentB.uri, rootBEventIndex)?.owner.kind === 'local',
        'independent root B local client',
      )
      assert.deepStrictEqual(independentRootsState.localClients.startedWorkspaceFolderUris, [
        rootA.uri.toString(),
        rootB.uri.toString(),
      ])
      assert.deepStrictEqual(
        activeOwnerKeys(independentRootsState, documentB.uri),
        new Set([localOwnerKey(rootB.uri.toString())]),
      )
      assertExclusiveOwners(independentRootsState)

      const markedMissingSchema = withDocumentEol(
        missingDocument,
        '// use prisma-next\nmodel MissingCliRecord {\n  id Int @id\n}\n',
      )
      const missingEventIndex = independentRootsState.routingEvents.length
      const missingOwnershipEventIndex = independentRootsState.ownershipEvents.length
      await replaceDocument(missingDocument, markedMissingSchema)
      const missingState = await waitForState(
        (state) =>
          hasLocalOwnershipAfter(state, missingDocument.uri, missingRoot.uri.toString(), missingOwnershipEventIndex) &&
          hasDiagnosticClearAfter(state, missingDocument.uri, 'bundled', missingEventIndex),
        'missing-entrypoint routing to settle without fallback',
      )
      assert.deepStrictEqual(missingState.localClients.startedWorkspaceFolderUris, [
        rootA.uri.toString(),
        rootB.uri.toString(),
      ])
      assert.strictEqual(
        missingState.localClients.startCountsByWorkspaceFolderUri[missingRoot.uri.toString()],
        undefined,
      )
      assert.deepStrictEqual(activeOwnerKeys(missingState, missingDocument.uri), new Set())
      assert.strictEqual(lastOpenedAfter(missingState, missingDocument.uri, missingEventIndex), undefined)
      assertExclusiveOwners(missingState)

      const restoredBundledSchema = withDocumentEol(documentA, 'model RootARestored {\n  id Int @id\n}\n')
      const removeDirectiveEventIndex = missingState.routingEvents.length
      await replaceDocument(documentA, restoredBundledSchema)
      const restoredState = await waitForState(
        (state) => lastOpenedAfter(state, documentA.uri, removeDirectiveEventIndex)?.owner.kind === 'bundled',
        'root A document to return to bundled ownership',
      )
      const bundledOpen = lastOpenedAfter(restoredState, documentA.uri, removeDirectiveEventIndex)
      assert.ok(bundledOpen)
      assert.strictEqual(bundledOpen.documentText, restoredBundledSchema)
      assert.strictEqual(bundledOpen.documentVersion, documentA.version)
      assert.strictEqual(
        hasDiagnosticClearAfter(restoredState, documentA.uri, 'local', removeDirectiveEventIndex),
        true,
        'expected local diagnostics to clear before bundled ownership',
      )
      assert.deepStrictEqual(activeOwnerKeys(restoredState, documentA.uri), new Set(['bundled']))
      assert.strictEqual(restoredState.localClients.startCountsByWorkspaceFolderUri[rootA.uri.toString()], 1)
      assertExclusiveOwners(restoredState)
      await waitForDiagnostics(
        documentA.uri,
        (diagnostics) => diagnostics.length === 0,
        'bundled diagnostics to clear after restoring valid text',
      )
    } finally {
      await restoreFixtures(fixtures)
    }
  })
})

async function getTestState(): Promise<LanguageServerTestState> {
  const state = await vscode.commands.executeCommand<LanguageServerTestState>(languageServerTestStateCommand)
  assert.ok(state, 'language-server test state command was not registered')
  return state
}

async function waitForState(
  predicate: (state: LanguageServerTestState) => boolean,
  description: string,
): Promise<LanguageServerTestState> {
  const deadline = Date.now() + stateTimeoutMs
  let state = await getTestState()
  while (!predicate(state) && Date.now() < deadline) {
    await sleep(100)
    state = await getTestState()
  }
  assert.ok(predicate(state), `Timed out waiting for ${description}`)
  return state
}

async function waitForDiagnostics(
  uri: vscode.Uri,
  predicate: (diagnostics: readonly vscode.Diagnostic[]) => boolean,
  description: string,
): Promise<readonly vscode.Diagnostic[]> {
  const deadline = Date.now() + diagnosticTimeoutMs
  let diagnostics = vscode.languages.getDiagnostics(uri)
  while (!predicate(diagnostics) && Date.now() < deadline) {
    await sleep(100)
    diagnostics = vscode.languages.getDiagnostics(uri)
  }
  assert.ok(predicate(diagnostics), `Timed out waiting for ${description} for ${uri.toString()}`)
  return diagnostics
}

async function replaceDocument(document: vscode.TextDocument, text: string): Promise<void> {
  await replaceDocumentText(document, text)
  assert.strictEqual(document.isDirty, true)
}

function withDocumentEol(document: vscode.TextDocument, text: string): string {
  const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n'
  return text.split('\r\n').join('\n').split('\n').join(eol)
}

interface FixtureSnapshot {
  readonly uri: vscode.Uri
  readonly bytes: Uint8Array
  readonly text: string
}

async function snapshotFixtures(uris: readonly vscode.Uri[]): Promise<FixtureSnapshot[]> {
  return Promise.all(
    uris.map(async (uri) => {
      const bytes = await vscode.workspace.fs.readFile(uri)
      return { uri, bytes, text: Buffer.from(bytes).toString('utf8') }
    }),
  )
}

async function restoreFixtures(fixtures: readonly FixtureSnapshot[]): Promise<void> {
  for (const fixture of fixtures) {
    const document = findOpenDocument(fixture.uri)
    if (document) {
      if (document.getText() !== fixture.text) {
        await replaceDocumentText(document, fixture.text)
      }
      if (document.isDirty && !(await document.save())) {
        await vscode.workspace.fs.writeFile(fixture.uri, fixture.bytes)
      }
    } else {
      await vscode.workspace.fs.writeFile(fixture.uri, fixture.bytes)
    }
  }

  for (const fixture of fixtures) {
    const document = findOpenDocument(fixture.uri)
    if (document) {
      assert.strictEqual(document.getText(), fixture.text, `Open fixture was not restored: ${fixture.uri.toString()}`)
      assert.strictEqual(document.isDirty, false, `Restored fixture remains dirty: ${fixture.uri.toString()}`)
    }
    assert.deepStrictEqual(
      await vscode.workspace.fs.readFile(fixture.uri),
      fixture.bytes,
      `On-disk fixture was not restored: ${fixture.uri.toString()}`,
    )
  }
}

async function replaceDocumentText(document: vscode.TextDocument, text: string): Promise<void> {
  const edit = new vscode.WorkspaceEdit()
  edit.replace(
    document.uri,
    new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)),
    text,
  )
  assert.strictEqual(await vscode.workspace.applyEdit(edit), true)
  assert.strictEqual(document.getText(), text)
}

function findOpenDocument(uri: vscode.Uri): vscode.TextDocument | undefined {
  return vscode.workspace.textDocuments.find((document) => document.uri.toString() === uri.toString())
}

function activeOwnerKeys(state: LanguageServerTestState, uri: vscode.Uri): Set<string> {
  const active = new Set<string>()
  for (const event of state.routingEvents) {
    if (event.documentUri !== uri.toString()) continue
    const key = ownerKey(event.owner)
    if (event.type === 'opened') {
      active.add(key)
    } else if (event.type === 'closed') {
      active.delete(key)
    }
  }
  return active
}

function assertExclusiveOwners(state: LanguageServerTestState): void {
  const activeByDocument = new Map<string, Set<string>>()
  for (const event of state.routingEvents) {
    const active = activeByDocument.get(event.documentUri) ?? new Set<string>()
    activeByDocument.set(event.documentUri, active)
    const key = ownerKey(event.owner)
    if (event.type === 'opened') {
      active.add(key)
      assert.ok(
        active.size <= 1,
        `Document ${event.documentUri} was observed on multiple owners: ${[...active].join(', ')}`,
      )
    } else if (event.type === 'closed') {
      active.delete(key)
    }
  }
}

function lastOpenedAfter(
  state: LanguageServerTestState,
  uri: vscode.Uri,
  eventIndex: number,
): Extract<DocumentRoutingEvent, { type: 'opened' }> | undefined {
  return state.routingEvents
    .slice(eventIndex)
    .filter(
      (event): event is Extract<DocumentRoutingEvent, { type: 'opened' }> =>
        event.type === 'opened' && event.documentUri === uri.toString(),
    )
    .at(-1)
}

function hasDiagnosticClearAfter(
  state: LanguageServerTestState,
  uri: vscode.Uri,
  owner: DocumentOwner['kind'],
  eventIndex: number,
): boolean {
  return state.routingEvents
    .slice(eventIndex)
    .some(
      (event) =>
        event.type === 'diagnosticsCleared' && event.documentUri === uri.toString() && event.owner.kind === owner,
    )
}

function hasLocalOwnershipAfter(
  state: LanguageServerTestState,
  uri: vscode.Uri,
  workspaceFolderUri: string,
  eventIndex: number,
): boolean {
  return state.ownershipEvents
    .slice(eventIndex)
    .some(
      (event) =>
        event.type === 'ownerChanged' &&
        event.documentUri === uri.toString() &&
        event.owner.kind === 'local' &&
        event.owner.workspaceFolderUri === workspaceFolderUri,
    )
}

function ownerKey(owner: DocumentOwner): string {
  return owner.kind === 'local' ? localOwnerKey(owner.workspaceFolderUri) : owner.kind
}

function localOwnerKey(workspaceFolderUri: string): string {
  return `local:${workspaceFolderUri}`
}
