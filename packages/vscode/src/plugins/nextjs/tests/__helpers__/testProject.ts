import { join } from 'path'
import { Project } from 'ts-morph'
import { addMissingImports } from '../../addImports'
import { addJSDoc } from '../../addJSDoc'
import { addTypesToPage } from '../../addTypesToPage'
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
    addJSDoc(sourceFile, foundFunctions)
  } else {
    addMissingImports(sourceFile, foundFunctions)
    addTypesToPage(sourceFile, foundFunctions)
  }
  await testProject.save()
}
