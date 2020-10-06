import { Project, ProjectOptions } from 'ts-morph'
import { window } from 'vscode'
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
    // const pagesGlob = options?.customPagesGlob || './pages/**/*.{ts,tsx,js,jsx}'
    // const globs = join(projectDir, pagesGlob)
    // Add source files
  }
  async run(filePath: string): Promise<void> {
    // Read more: https://ts-morph.com/setup/
    const sourceFile = this.project.addSourceFileAtPath(filePath)

    console.log(sourceFile.getFilePath())
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

const plugin: PrismaVSCodePlugin = {
  name: 'nextjs',
  commands: [
    {
      commandId: 'prisma.plugin.nextjs.addTypes',
      action: async () => {
        const filename = window.activeTextEditor?.document.fileName
        if (filename && filename.includes('pages')) {
          try {
            await nextTypes.run(filename)
          } catch (e) {
            console.error(e)
          }
        } else {
          void window.showErrorMessage(
            'This can only be used in a NextJS pages Directory',
          )
        }
      },
    },
  ],
}
export default plugin
