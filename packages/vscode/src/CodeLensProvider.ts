import * as vscode from 'vscode'
import * as cp from 'child_process'

/**
 * CodelensProvider
 */
export class CodelensProvider implements vscode.CodeLensProvider {
  private enabled: boolean

  private generatorRegex: RegExp
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>()
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event

  constructor() {
    this.generatorRegex = /(generator +[a-zA-Z0-9]+ +{)/g
    this.enabled = vscode.workspace.getConfiguration('prisma').get('enableCodeLens', true)

    vscode.workspace.onDidChangeConfiguration((_) => {
      this._onDidChangeCodeLenses.fire()
    })
  }

  public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] {
    if (!this.enabled) {
      return []
    }

    const codelenses = this.getCodeLensGenerateSchema(document, token)
    return ([] as vscode.CodeLens[]).concat(...codelenses)
  }

  private getCodeLensGenerateSchema(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] {
    const generatorRanges = this.getGeneratorRange(document, token)

    const lenses = generatorRanges.map(
      (range) =>
        new vscode.CodeLens(range, {
          title: 'Generate',
          command: 'prisma.generate',
          tooltip: `Run "prisma generate"`,
          // ? (@druue) The arguments property does not seem to actually
          // ? return an array of arguments. It would consistently
          // ? return one singular string element, even when defined as:
          // ? [this.scriptRunner, this.schemaPath]
          // ?
          // ? I've tried to understand why as there are usages in other
          // ? codebases that do pass in multiple args so I have to imagine
          // ? that it can work, but unsure.
          // ? Reference: https://github.com/microsoft/vscode-extension-samples/blob/main/codelens-sample/
          // ? arguments: [this.scriptRunner]
        }),
    )

    return lenses
  }

  // ? (@druue) I really don't like finding it like this :|
  private getGeneratorRange(document: vscode.TextDocument, _token: vscode.CancellationToken): vscode.Range[] {
    const regex = new RegExp(this.generatorRegex)
    const text = document.getText()

    const ranges = []
    let matches
    while ((matches = regex.exec(text)) !== null) {
      const line = document.lineAt(document.positionAt(matches.index).line)
      const indexOf = line.text.indexOf(matches[0])
      const position = new vscode.Position(line.lineNumber, indexOf)
      const range = document.getWordRangeAtPosition(position, new RegExp(this.generatorRegex))
      if (range) {
        ranges.push(range)
      }
    }

    return ranges
  }
}

export function generateClient(_args: string) {
  const prismaGenerateOutputChannel = vscode.window.createOutputChannel('Prisma Generate')
  const rootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath

  const scriptRunner = vscode.workspace.getConfiguration('prisma').get('scriptRunner', 'npx')
  const schemaPath: string | undefined = vscode.workspace.getConfiguration('prisma').get('schemaPath')

  const pathArgFlag = ` --schema=${schemaPath}`
  const cmd = `${scriptRunner} prisma generate${schemaPath ? pathArgFlag : ''}`

  prismaGenerateOutputChannel.clear()
  prismaGenerateOutputChannel.show(true)
  prismaGenerateOutputChannel.appendLine(['Running prisma generate:', rootPath, cmd].join('\n- '))

  const handleExec = (err: cp.ExecException | null, stdout: string, stderr: string) => {
    try {
      if (err) {
        prismaGenerateOutputChannel.appendLine(err.message)
        return
      }
      if (stdout) {
        prismaGenerateOutputChannel.append(stdout)
      }
      if (stderr) {
        prismaGenerateOutputChannel.append(stderr)
      }
    } catch (e) {
      prismaGenerateOutputChannel.append(e as string)
    }
  }

  cp.exec(cmd, { cwd: rootPath }, (err, stdout, stderr) => handleExec(err, stdout, stderr))
}
