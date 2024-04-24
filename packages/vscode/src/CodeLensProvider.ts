import * as vscode from 'vscode'
import * as cp from 'child_process'

/**
 * CodelensProvider
 */
export class CodelensProvider implements vscode.CodeLensProvider {
  private enabled: boolean
  private scriptRunner: string
  private generatorRegex: RegExp
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>()
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event

  constructor() {
    this.generatorRegex = /(generator [a-zA-Z]+ {)/g
    this.enabled = vscode.workspace.getConfiguration('prisma').get('enableCodeLens', true)
    this.scriptRunner = vscode.workspace.getConfiguration('prisma').get('scriptRunner')!

    vscode.workspace.onDidChangeConfiguration((_) => {
      this._onDidChangeCodeLenses.fire()
    })
  }

  public updateScriptRunner(scriptRunner: string) {
    this.scriptRunner = scriptRunner
  }

  public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] {
    if (!this.enabled) {
      return []
    }

    const codelenses = [this.getCodeLensGenerateSchema(document, token)]
    return ([] as vscode.CodeLens[]).concat(...codelenses)
  }

  private getCodeLensGenerateSchema(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] {
    const generatorRange = this.getGeneratorRange(document, token)

    return generatorRange
      ? [
          new vscode.CodeLens(generatorRange, {
            title: 'Generate Prisma Client',
            command: 'prisma.generateClient',
            tooltip: 'Codelens to generate your Prisma client',
            arguments: [this.scriptRunner],
          }),
        ]
      : []
  }

  // ? (@druue) I really don't like finding it like this :|
  private getGeneratorRange(document: vscode.TextDocument, _token: vscode.CancellationToken): vscode.Range | undefined {
    const regex = new RegExp(this.generatorRegex)
    const text = document.getText()

    let matches
    while ((matches = regex.exec(text)) !== null) {
      const line = document.lineAt(document.positionAt(matches.index).line)
      const indexOf = line.text.indexOf(matches[0])
      const position = new vscode.Position(line.lineNumber, indexOf)
      const range = document.getWordRangeAtPosition(position, new RegExp(this.generatorRegex))
      if (range) {
        return range
      }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generateClient(args: any) {
  const prismaGenerateOutputChannel = vscode.window.createOutputChannel('Prisma Generate')
  const rootPath = vscode.workspace.workspaceFolders?.[0].uri.path
  const cmd = `(cd ${rootPath} && ${args} prisma generate)`

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

  cp.exec(cmd, (err, stdout, stderr) => handleExec(err, stdout, stderr))
}
