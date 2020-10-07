import { SourceFile } from 'ts-morph'
import { NextFunctionName, NextFunctionType } from './constants'

/**
 * Adds the Required NextJS type imports if they are missing
 */
export function addMissingImports(
  sourceFile: SourceFile,
  foundNextFunctions: NextFunctionType,
): void {
  Object.keys(foundNextFunctions).forEach((functionName) => {
    addImportIfMissing(
      sourceFile,
      foundNextFunctions[functionName as NextFunctionName].import,
    )
  })
}

export function addImportIfMissing(sourceFile: SourceFile, type: string): void {
  // import { GetServerSidePropsContext, InferGetServerSidePropsType } from 'next';
  let nextImport = sourceFile.getImportDeclaration('next')
  let hasTypeImport = false
  if (!nextImport) {
    nextImport = sourceFile.addImportDeclaration({
      moduleSpecifier: 'next',
      namedImports: [type],
    })
  } else {
    const namedImports = nextImport.getNamedImports()
    hasTypeImport = namedImports.map((is) => is.getText()).includes(type)
    if (!hasTypeImport) {
      nextImport.addNamedImport(type)
    }
  }
}
