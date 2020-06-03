import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient'
import * as vscode from 'vscode'
import path from 'path'
import { exec } from 'child_process';

let client: LanguageClient
let generatePrismaStatusBarItem: vscode.StatusBarItem
let prismaVersionStatusBarItem: vscode.StatusBarItem
let introspectPrismaStatusBarItem: vscode.StatusBarItem

function executeCommand(command: string) {
  if (vscode.window.activeTerminal) {
    vscode.window.activeTerminal.show()
    vscode.window.activeTerminal.sendText(command)
  } else {
    const terminal = vscode.window.createTerminal()
    terminal.show()
    terminal.sendText(command)
  }
}

export function activate(context: vscode.ExtensionContext): void {
  // register a command that is invoked when the status bar
  // item is selected
  const generatePrismaCommandId = 'prisma.generate';
  const prismaVersionCommandId = 'prisma.version';
  const introspectPrismaCommandId = 'prisma.introspect'


  context.subscriptions.push(vscode.commands.registerCommand(generatePrismaCommandId, () => {
    executeCommand('npx prisma generate')
  }));
  context.subscriptions.push(vscode.commands.registerCommand(prismaVersionCommandId, () => {
    executeCommand('npx prisma -v')
  }))
  context.subscriptions.push(vscode.commands.registerCommand(introspectPrismaCommandId, () => {
    executeCommand('npx prisma introspect')
  }))

  if (vscode.window.activeTerminal) {
    vscode.window.activeTerminal.sendText('npx prisma -v')
  } else {
    vscode.window.createTerminal().sendText('npx prisma -v')
  }

  // create new status bar items that we can now manage
  generatePrismaStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 200)
  generatePrismaStatusBarItem.text = '$(triangle-right) Prisma Generate'
  generatePrismaStatusBarItem.tooltip = 'Run this command to install and generate Prisma Client in your project.'
  generatePrismaStatusBarItem.command = generatePrismaCommandId
  context.subscriptions.push(generatePrismaStatusBarItem)

  prismaVersionStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 200)
  prismaVersionStatusBarItem.text = '$(triangle-right) Prisma Version'
  prismaVersionStatusBarItem.command = prismaVersionCommandId
  context.subscriptions.push(prismaVersionStatusBarItem)

  introspectPrismaStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 200)
  introspectPrismaStatusBarItem.text = '$(triangle-right) Prisma Introspect'
  introspectPrismaStatusBarItem.command = introspectPrismaCommandId
  introspectPrismaStatusBarItem.tooltip = 'This command introspects your database and for each table adds a Prisma model to the Prisma schema.'
  context.subscriptions.push(introspectPrismaStatusBarItem)


  // The server is implemented in node
  const serverModule = context.asAbsolutePath(
    path.join('server', 'out', 'server.js'),
  )
  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] }

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  }

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: [{ scheme: 'file', language: 'prisma' }],
  }

  // Create the language client and start the client.
  client = new LanguageClient(
    'lsp-prisma-client',
    'Prisma Language Server',
    serverOptions,
    clientOptions,
  )

  prismaVersionStatusBarItem.show()
  generatePrismaStatusBarItem.show()
  introspectPrismaStatusBarItem.show()
  // Start the client. This will also launch the server
  context.subscriptions.push(client.start())
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined
  }
  return client.stop()
}
