import path from 'path'
import vscode from 'vscode'

// Path from dist-tests/__test__/helper.js to package.json
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const packageJson = require('../../package.json') as { publisher: string; name: string }

export let doc: vscode.TextDocument
export let editor: vscode.TextEditor
export let documentEol: string
export let platformEol: string

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Activates the vscode.prisma extension
 * @todo check readiness of the server instead of timeout
 */
export async function activate(docUri: vscode.Uri): Promise<void> {
  // The extensionId is `publisher.name` from package.json
  const ext = vscode.extensions.getExtension(`${packageJson.publisher}.${packageJson.name}`)
  if (!ext) {
    console.error('Failed to get extension.')
    return
  }
  await ext.activate()
  try {
    doc = await vscode.workspace.openTextDocument(docUri)
    editor = await vscode.window.showTextDocument(doc)
    await sleep(2500) // Wait for server activation
  } catch (e) {
    console.error(e)
  }
}

export function toRange(sLine: number, sChar: number, eLine: number, eChar: number): vscode.Range {
  const start = new vscode.Position(sLine, sChar)
  const end = new vscode.Position(eLine, eChar)
  return new vscode.Range(start, end)
}

// Path from dist-tests/__test__/helper.js to fixtures/
export const getDocPath = (p: string): string => {
  return path.join(__dirname, '../../fixtures', p)
}
export const getDocUri = (p: string): vscode.Uri => {
  return vscode.Uri.file(getDocPath(p))
}

export async function setTestContent(content: string): Promise<boolean> {
  const all = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length))
  return editor.edit((eb) => eb.replace(all, content))
}
