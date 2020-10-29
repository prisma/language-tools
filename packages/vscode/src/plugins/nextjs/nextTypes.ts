import { Project, ProjectOptions } from 'ts-morph'
import { addMissingImports } from './addImports'
import { addJSDoc } from './addJSDoc'
import { addTSType } from './addTSType'
import { findNodes } from './findNodes'
import { getUsedNextFunctions, isJS } from './utils'
export interface Options {
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
    if (foundFunctions) {
      if (isJS(sourceFile)) {
        findNodes(sourceFile, foundFunctions, addJSDoc)
      } else {
        addMissingImports(sourceFile, foundFunctions)
        findNodes(sourceFile, foundFunctions, addTSType)
      }
      if (this.options?.save) {
        await this.project.save()
      }
    }
    this.project.removeSourceFile(sourceFile)
  }
}
