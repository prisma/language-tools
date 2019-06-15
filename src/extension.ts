import * as vscode from 'vscode';
import PrismaEditProvider from './provider'
import * as path from 'path'
import * as fs from 'fs'
import install from './install'
const exec_path = path.join(__dirname, '../prisma-fmt')

export async function activate(context: vscode.ExtensionContext) {
  if(!fs.existsSync(exec_path)) {
    try {
      await install(exec_path)
      vscode.window.showInformationMessage("prisma-fmt installation succeeded.")
    } catch (err) {
      // No error on install error.
      // vscode.window.showErrorMessage("Cannot install prisma-fmt: " + err)
    }
  }
  vscode.languages.registerDocumentFormattingEditProvider('prisma', new PrismaEditProvider(exec_path)) 
}