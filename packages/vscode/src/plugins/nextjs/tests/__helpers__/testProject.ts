import { join } from 'path'
import { Project } from 'ts-morph'
import { addMissingImports } from '../../addImports'
import { addJSDoc } from '../../addJSDoc'
import { addTSType } from '../../addTSType'
import { findNodes } from '../../findNodes'
import { getUsedNextFunctions, isJS } from '../../utils'

let testProject: Project | null

export async function runTestProject(
  projectDir: string,
  fileToTest: string,
): Promise<void> {
  // Read more: https://ts-morph.com/setup/
  testProject =
    testProject ||
    new Project({
      compilerOptions: {
        allowJs: true,
      },
    })
  const pagesGlob = `./${fileToTest}`
  const globs = join(projectDir, pagesGlob)
  const sourceFile = testProject.addSourceFileAtPath(globs)
  // Add source files
  const foundFunctions = getUsedNextFunctions(sourceFile)
  if (isJS(sourceFile)) {
    findNodes(sourceFile, foundFunctions, addJSDoc)
  } else {
    addMissingImports(sourceFile, foundFunctions)
    findNodes(sourceFile, foundFunctions, addTSType)
  }
  await testProject.save()
}
