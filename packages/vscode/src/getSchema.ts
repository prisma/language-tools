import { window, workspace } from 'vscode'


export async function getSchemaPath(): Promise<string | null> {
  // try the currently open document
  let schemaPath = window.activeTextEditor?.document.fileName
  if (schemaPath && schemaPath.endsWith('.prisma')) {
    return schemaPath
  }

  // try the workspace
  let fileInWorkspace = await workspace.findFiles('**/schema.prisma', '**/node_modules/**')
  if (fileInWorkspace.length !== 0) {
    return fileInWorkspace[0].toString()
  }
  
  return null
}

