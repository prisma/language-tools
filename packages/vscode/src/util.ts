import {
  WorkspaceEdit,
  window,
  TextEdit,
  SnippetString,
  TextEditorEdit,
  env,
  workspace,
  WorkspaceConfiguration,
} from 'vscode'
import { CodeAction, TextDocumentIdentifier } from 'vscode-languageclient'
import { denyListDarkColorThemes, denyListLightColorThemes } from './denyListColorThemes';

export function isDebugOrTestSession(): boolean {
  return env.sessionId === 'someValue.sessionId'
}

function removeElementFromVSCodeConfig(config: { [key: string]: string }, itemKey: string) {
  return Object.keys(config)
    .filter(sKey => sKey != itemKey)
    .reduce((obj: any, key: string) => {
      obj[key] = config[key];
      return obj;
    }, {});
}

function showToastToSwitchColorTheme(currentTheme: string, suggestedTheme: string) {
  window.showWarningMessage(`The VSCode Color Theme '${currentTheme}' you are using unfortunately does not fully support syntax highlighting. We suggest you switch to '${suggestedTheme}' which does fully support it and will give you a better experience.`)
}

export function checkForMinimalColorTheme() {
  const colorTheme = workspace.getConfiguration('workbench').get("colorTheme")
  if (!colorTheme) {
    return
  }

  console.log(colorTheme)

  if (denyListDarkColorThemes.includes(colorTheme as string)) {
    showToastToSwitchColorTheme(colorTheme as string, 'Dark+ (Visual Studio)')
  }
  if (denyListLightColorThemes.includes(colorTheme as string)) {
    showToastToSwitchColorTheme(colorTheme as string, 'Light+ (Visual Studio)')
  }
}

export async function enablePrismaNodeModulesFolderWatch(): Promise<void> {
  const config: WorkspaceConfiguration = workspace.getConfiguration(undefined, null)
  let value = config.get<{ [key: string]: string }>('files.watcherExclude', {})
  const newKey = '**/node_modules/{[^.],?[^p],??[^r],???[^i],????[^s],?????[^m]}*'

  if (typeof value === 'string') {
    value = JSON.parse(value)
  }

  const nodeModulesKeys = Object.keys(value).filter(key => key.includes('node_modules') && key !== newKey)

  if (nodeModulesKeys.length !== 0) {
    // Copy boolean value
    value[newKey] =
      value[nodeModulesKeys[0]]

    if (nodeModulesKeys.length === 1) {
      // Delete original exclude
      // workaround from https://github.com/fabiospampinato/vscode-terminals/issues/32#issuecomment-621599992
      value = removeElementFromVSCodeConfig(value, nodeModulesKeys[0])
    } else {
      // found multiple keys with node_modules
      console.log("Found multiple keys including 'node_modules' inside 'files.watcherExclude' VSCode setting.")
      nodeModulesKeys.forEach(key => {
        value = removeElementFromVSCodeConfig(value, key)
      })
    }
    try {
      await config.update('files.watcherExclude', value)
      console.log('Successfully updated setting files.watcherExclude')
    } catch (err) {
      console.error('Updating user setting files.watcherExclude failed')
      console.error(err)
    }
  } else {
    console.log('Not updating user setting.')
  }
}

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
