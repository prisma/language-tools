import vscode from 'vscode'
import path from 'path'

export let doc: vscode.TextDocument
export let editor: vscode.TextEditor
export let documentEol: string
export let platformEol: string

export async function sleep(ms: number): Promise<NodeJS.Timeout> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Activates the vscode.prisma-vscode extension
 */
export async function activate(docUri: vscode.Uri): Promise<void> {
  // The extensionId is `publisher.name` from package.json
  const ext = vscode.extensions.getExtension('Prisma.prisma-vsocde')!
  await ext.activate()
  try {
    doc = await vscode.workspace.openTextDocument(docUri)
    editor = await vscode.window.showTextDocument(doc)
    await sleep(2000) // Wait for server activation
  } catch (e) {
    console.error(e)
  }
}

export function toRange(
  sLine: number,
  sChar: number,
  eLine: number,
  eChar: number,
): vscode.Range {
  const start = new vscode.Position(sLine, sChar)
  const end = new vscode.Position(eLine, eChar)
  return new vscode.Range(start, end)
}

export const getDocPath = (p: string): string => {
  return path.resolve(__dirname, '../../testFixture', p)
}
export const getDocUri = (p: string): vscode.Uri => {
  return vscode.Uri.file(getDocPath(p))
}

export async function setTestContent(content: string): Promise<boolean> {
  const all = new vscode.Range(
    doc.positionAt(0),
    doc.positionAt(doc.getText().length),
  )
  return editor.edit((eb) => eb.replace(all, content))
}
