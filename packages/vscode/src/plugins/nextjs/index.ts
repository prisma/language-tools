import {
  commands,
  TextDocument,
  TextDocumentSaveReason,
  TextDocumentWillSaveEvent,
  window,
  workspace,
} from 'vscode'
import { packageJsonIncludes } from '../../helpers/workspace'
import { PrismaVSCodePlugin } from '../types'
import { NextTypes } from './nextTypes'

const nextTypes = new NextTypes({ save: true })
const supportedLanguageIds = [
  'typescriptreact',
  'javascriptreact',
  'typescript',
  'javascript',
]
// This is used to get around other plugins that modify the document in onWillSave
let shouldUpdate = false

const plugin: PrismaVSCodePlugin = {
  name: 'nextjs',
  enabled: async () => {
    // TODO Add Workspace Support currently only checks the workspace root for deps
    const hasNext = await packageJsonIncludes('next', ['dependencies'])
    const hasPrismaCLI = await packageJsonIncludes('@prisma/cli', [
      'devDependencies',
    ])

    return hasNext && hasPrismaCLI
  },
  activate: (context) => {
    const shouldAutoFormat = workspace
      .getConfiguration('prisma.plugin.nextjs')
      .get('addTypesOnSave')

    if (shouldAutoFormat) {
      workspace.onWillSaveTextDocument((e: TextDocumentWillSaveEvent) => {
        if (
          e.reason === TextDocumentSaveReason.Manual &&
          supportedLanguageIds.includes(e.document.languageId)
        ) {
          shouldUpdate = true
        }
      })
      const onSaveDisposable = workspace.onDidSaveTextDocument(
        async (document: TextDocument) => {
          if (shouldUpdate) {
            await formatDocument(document)
          }
          shouldUpdate = false
        },
      )
      context.subscriptions.push(onSaveDisposable)
      context.subscriptions.push(
        commands.registerCommand('prisma.plugin.nextjs.addTypes', async () => {
          await formatDocument()
        }),
      )
    }
  },
}
async function formatDocument(document?: TextDocument) {
  const filename = document
    ? document.fileName
    : window.activeTextEditor?.document.fileName
  if (filename && filename.includes('pages')) {
    try {
      console.log(`Adding Types to ${filename}`)
      await nextTypes.run(filename)
    } catch (e) {
      console.error(e)
    }
  } else {
    console.warn('This can only be used in a NextJS pages Directory')
  }
}
export default plugin
