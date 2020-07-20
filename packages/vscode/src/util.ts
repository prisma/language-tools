import {
  WorkspaceEdit,
  window,
  TextEdit,
  SnippetString,
  TextEditorEdit,
} from 'vscode'
import { CodeAction, TextDocumentIdentifier } from 'vscode-languageclient'

export function isSnippetEdit(
  action: CodeAction,
  document: TextDocumentIdentifier,
): boolean {
  const changes = action.edit?.changes
  if (changes !== undefined && changes[document.uri]) {
    if (changes[document.uri].some((e) => e.newText.includes('{\n\n}\n'))) {
      return true
    }
  }
  return false
}

export function applySnippetWorkspaceEdit(): (
  edit: WorkspaceEdit,
) => Promise<void> {
  return async (edit: WorkspaceEdit) => {
    const [uri, edits] = edit.entries()[0]

    const editor = window.visibleTextEditors.find(
      (it) => it.document.uri.toString() === uri.toString(),
    )
    if (!editor) return

    let editWithSnippet: TextEdit | undefined = undefined
    let lineDelta = 0
    await editor.edit((builder: TextEditorEdit) => {
      for (const indel of edits) {
        if (indel.newText.includes('$0')) {
          editWithSnippet = indel
        } else if (indel.newText.includes('{\n\n}')) {
          indel.newText = indel.newText.replace('{\n\n}', '{\n\t$0\n}')
          editWithSnippet = indel
        } else {
          if (!editWithSnippet) {
            lineDelta =
              (indel.newText.match(/\n/g) || []).length -
              (indel.range.end.line - indel.range.start.line)
          }
          builder.replace(indel.range, indel.newText)
        }
      }
    })
    if (editWithSnippet) {
      const snip = editWithSnippet as TextEdit
      const range = snip.range.with(
        snip.range.start.with(snip.range.start.line + lineDelta),
        snip.range.end.with(snip.range.end.line + lineDelta),
      )
      await editor.insertSnippet(new SnippetString(snip.newText), range)
    }
  }
}
