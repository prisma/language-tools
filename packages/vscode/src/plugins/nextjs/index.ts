import path from 'path'
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
  activate: async (context) => {
    const shouldAutoFormat = workspace
      .getConfiguration('prisma.plugin.nextjs')
      .get('addTypesOnSave')
    const hasPrompted = workspace
      .getConfiguration('prisma.plugin.nextjs')
      .get('hasPrompted')
    // TODO Someone please help with a better message
    if (!hasPrompted) {
      const res = await window.showInformationMessage(
        'Would you like to enable nextjs-prisma autotypes [EXPERIMENTAL]',
        'Yes',
        'No',
      )
      const config = workspace.getConfiguration('prisma.plugin.nextjs')
      if (res === 'Yes') {
        await config.update('addTypesOnSave', true)
      }
      await config.update('hasPrompted', true)
    }
    if (shouldAutoFormat) {
      workspace.onWillSaveTextDocument((e: TextDocumentWillSaveEvent) => {
        const shouldAutoFormat = workspace
          .getConfiguration('prisma.plugin.nextjs')
          .get('addTypesOnSave')
        if (
          e.reason === TextDocumentSaveReason.Manual &&
          supportedLanguageIds.includes(e.document.languageId) &&
          shouldAutoFormat
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
  if (
    filename &&
    filename.includes('pages') &&
    !filename.includes(path.join('pages', 'api'))
  ) {
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
