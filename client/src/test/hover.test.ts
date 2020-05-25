import vscode, { Hover, MarkdownString } from 'vscode'
import assert from 'assert'
import { getDocUri, activate } from './helper'
import { MarkedString } from 'vscode-languageclient'

async function testHover(
    docUri: vscode.Uri,
    position: vscode.Position,
    expectedHover: string,
): Promise<void> {
    await activate(docUri)

    const actualHover: Hover[] = (await vscode.commands.executeCommand(
        'vscode.executeHoverProvider',
        docUri,
        position
    )) as Hover[]

    assert.ok(actualHover.length === 1)
    assert.ok(actualHover[0].contents.length === 1)
    const result = actualHover[0].contents[0] as vscode.MarkdownString
    assert.deepStrictEqual(result.value, expectedHover)
}

suite('Should show /// documentation comments for', () => {
    const docUri = getDocUri('hover.prisma')

    test('model', async () => {
        await testHover(
            docUri,
            new vscode.Position(23, 10),
            'Post including an author and content.'
        )
    })
    test('enum', async () => {
        await testHover(
            docUri,
            new vscode.Position(24, 17),
            'This is an enum specifying the UserName.'
        )
    })
})
suite('Should show // comments for', () => {
    const docUri = getDocUri('hover.prisma')

    test('model', async() => {
        await testHover(
            docUri,
            new vscode.Position(14, 15),
            'Documentation for this model.')
    })
    test('enum', async () => {
        await testHover(
            docUri, 
            new vscode.Position(25, 9),
            'This is a test enum.'
        )
    })
})