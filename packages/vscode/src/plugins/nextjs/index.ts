import { Project, ProjectOptions } from 'ts-morph'
import {
  TextDocument,
  TextDocumentSaveReason,
  TextDocumentWillSaveEvent,
  window,
  workspace,
} from 'vscode'
import { packageJsonIncludes } from '../../helpers/workspace'
import { PrismaVSCodePlugin } from '../types'
import { addMissingImports } from './addImports'
import { addJSDoc } from './addJSDoc'
import { addTypesToPage } from './addTypesToPage'
import { getUsedNextFunctions, isJS } from './utils'

interface Options {
  tsProjectOptions?: ProjectOptions
  /**
   * default:  "./pages/**\/*.{ts,tsx,js,jsx}"
   */
  customPagesGlob?: string
  /**
   * default:  true
   */
  save: boolean
}

export class NextTypes {
  project: Project
  options: Options | undefined
  constructor(options?: Options) {
    this.project = new Project({
      skipFileDependencyResolution: true,
      skipLoadingLibFiles: false,
      ...options?.tsProjectOptions,
      compilerOptions: {
        allowJs: true,
        ...options?.tsProjectOptions?.compilerOptions,
      },
    })
    this.options = options
  }
  async run(filePath: string): Promise<void> {
    // Read more: https://ts-morph.com/setup/
    const sourceFile = this.project.addSourceFileAtPath(filePath)

    const foundFunctions = getUsedNextFunctions(sourceFile)
    if (isJS(sourceFile)) {
      addJSDoc(sourceFile, foundFunctions)
    } else {
      addMissingImports(sourceFile, foundFunctions)
      addTypesToPage(sourceFile, foundFunctions)
    }
    if (this.options?.save) {
      await this.project.save()
    }
    this.project.removeSourceFile(sourceFile)
  }
}

const nextTypes = new NextTypes({ save: true })
// This is used to get around other plugins that modify the document in onWillSave
let shouldUpdate = false
const plugin: PrismaVSCodePlugin = {
  name: 'nextjs',
  enabled: () => packageJsonIncludes('next'),
  activate: () => {
    const shouldAutoFormat = workspace
      .getConfiguration('prisma.plugin.nextjs')
      .get('addTypesOnSave')
    console.log({ shouldAutoFormat })
    if (shouldAutoFormat) {
      workspace.onWillSaveTextDocument((e: TextDocumentWillSaveEvent) => {
        // This insures that it is only run when a user saves the doument
        if (e.reason === TextDocumentSaveReason.Manual) {
          shouldUpdate = true
        }
      })
      workspace.onDidSaveTextDocument(async (document: TextDocument) => {
        if (shouldUpdate) {
          await formatDocument(document)
        }
        shouldUpdate = false
      })
    }
  },
  commands: [
    {
      id: 'prisma.plugin.nextjs.addTypes',
      action: async () => {
        await formatDocument()
      },
    },
  ],
}
async function formatDocument(document?: TextDocument) {
  const filename = document
    ? document.fileName
    : window.activeTextEditor?.document.fileName
  if (filename && filename.includes('pages')) {
    try {
      console.log(`Running - ${filename}`)
      await nextTypes.run(filename)
    } catch (e) {
      console.error(e)
    }
  } else {
    console.warn('This can only be used in a NextJS pages Directory')
  }
}
export default plugin
