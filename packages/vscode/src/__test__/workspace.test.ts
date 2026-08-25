import assert from 'node:assert'
import vscode from 'vscode'

const completionTimeoutMs = 30_000
const completionPollIntervalMs = 100

suite('Prisma language server routing', () => {
  test('provides bundled Prisma 7 and workspace-local Prisma 8 completions side by side', async () => {
    const workspaceFolders = vscode.workspace.workspaceFolders
    assert.ok(workspaceFolders)
    assert.strictEqual(workspaceFolders.length, 1)
    const root = workspaceFolders[0]

    const bundledUri = vscode.Uri.joinPath(root.uri, 'bundled.prisma')
    const nextUri = vscode.Uri.joinPath(root.uri, 'next.prisma')
    const bundledDocument = await vscode.workspace.openTextDocument(bundledUri)
    await vscode.window.showTextDocument(bundledDocument, { viewColumn: vscode.ViewColumn.One })
    const nextDocument = await vscode.workspace.openTextDocument(nextUri)
    await vscode.window.showTextDocument(nextDocument, { viewColumn: vscode.ViewColumn.Two })

    const extension = vscode.extensions.getExtension('Prisma.prisma')
    assert.ok(extension)
    await extension.activate()

    const bundledCompletions = await waitForCompletions(
      bundledUri,
      new vscode.Position(0, 0),
      (completions) =>
        ['datasource', 'generator', 'model'].every((label) => hasLabel(completions, label)) &&
        findCompletion(completions, 'datasource')?.kind === vscode.CompletionItemKind.Class,
      'bundled Prisma 7 declaration completions',
    )
    const bundledDatasource = findCompletion(bundledCompletions, 'datasource')
    assert.ok(bundledDatasource)
    assert.strictEqual(bundledDatasource.kind, vscode.CompletionItemKind.Class)
    assert.ok(hasLabel(bundledCompletions, 'generator'))
    assert.ok(hasLabel(bundledCompletions, 'model'))
    assert.ok(!hasLabel(bundledCompletions, 'namespace'))

    const nextCompletions = await waitForCompletions(
      nextUri,
      new vscode.Position(1, 0),
      (completions) => {
        const namespace = findCompletion(completions, 'namespace')
        return namespace?.kind === vscode.CompletionItemKind.Keyword && namespace.detail === 'PSL declaration keyword'
      },
      'workspace-local Prisma 8 declaration completions',
    )
    const namespace = findCompletion(nextCompletions, 'namespace')
    assert.ok(namespace)
    assert.strictEqual(namespace.kind, vscode.CompletionItemKind.Keyword)
    assert.strictEqual(namespace.detail, 'PSL declaration keyword')
    assert.ok(!hasLabel(nextCompletions, 'datasource'))
  })
})

async function waitForCompletions(
  uri: vscode.Uri,
  position: vscode.Position,
  predicate: (completions: vscode.CompletionList) => boolean,
  description: string,
): Promise<vscode.CompletionList> {
  const deadline = Date.now() + completionTimeoutMs
  let lastCompletions: vscode.CompletionList | undefined
  let lastError: unknown

  while (Date.now() < deadline) {
    try {
      lastCompletions = await vscode.commands.executeCommand<vscode.CompletionList>(
        'vscode.executeCompletionItemProvider',
        uri,
        position,
      )
      if (lastCompletions && predicate(lastCompletions)) {
        return lastCompletions
      }
    } catch (error) {
      lastError = error
    }
    await sleep(completionPollIntervalMs)
  }

  const labels = lastCompletions?.items.map(completionLabel).join(', ') ?? '<none>'
  const error = lastError instanceof Error ? ` Last error: ${lastError.message}` : ''
  throw new Error(`Timed out waiting for ${description}. Last completion labels: ${labels}.${error}`)
}

function findCompletion(completions: vscode.CompletionList, label: string): vscode.CompletionItem | undefined {
  return completions.items.find((item) => completionLabel(item) === label)
}

function hasLabel(completions: vscode.CompletionList, label: string): boolean {
  return findCompletion(completions, label) !== undefined
}

function completionLabel(item: vscode.CompletionItem): string {
  return typeof item.label === 'string' ? item.label : item.label.label
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}
