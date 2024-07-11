import vscode, { Hover } from 'vscode'
import assert from 'assert'
import { getDocUri, activate } from '../helper'

async function testHover(docUri: vscode.Uri, position: vscode.Position, expectedHover: string): Promise<void> {
  const actualHover: Hover[] = (await vscode.commands.executeCommand(
    'vscode.executeHoverProvider',
    docUri,
    position,
  )) as Hover[]

  assert.ok(actualHover.length === 1)
  assert.ok(actualHover[0].contents.length === 1)
  const result = actualHover[0].contents[0] as vscode.MarkdownString
  assert.deepStrictEqual(result.value, expectedHover)
}

suite('Should show /// documentation comments for', () => {
  const docUri = getDocUri('hover/schema.prisma')

  // ! Day 9045093485940 of wishing for inline snapshots.
  const expectedHover = `\`\`\`prisma\nmodel Post {\n\t...\n\tauthor User? @relation(name: "PostToUser", fields: [authorId], references: [id])\n}\n\`\`\`\n___\none-to-many\n___\nPost including an author and content.`

  test('model', async () => {
    await activate(docUri)
    await testHover(docUri, new vscode.Position(23, 10), expectedHover)
  })
})
