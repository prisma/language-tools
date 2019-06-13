import * as vscode from 'vscode';
import PrismaEditProvider from './provider'

export function activate(context: vscode.ExtensionContext) {
  vscode.languages.registerDocumentFormattingEditProvider('prisma', new PrismaEditProvider()) 
}