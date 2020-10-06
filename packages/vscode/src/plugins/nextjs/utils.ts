import path from 'path'
import { SourceFile } from 'ts-morph'
import { NextFunctionName, NextFunctions, NextFunctionType } from './constants'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function isJS(sourceFile: SourceFile) {
  const filePath = sourceFile.getFilePath()
  const extension = path.extname(filePath)
  return extension.includes('js')
}

export function getUsedNextFunctions(sourceFile: SourceFile): NextFunctionType {
  const exports = sourceFile?.getSymbol()?.getExports()
  const foundFunctions = {} as NextFunctionType
  exports?.forEach((e) => {
    const name = e.getName()
    if (Object.keys(NextFunctions).includes(name)) {
      foundFunctions[name as NextFunctionName] =
        NextFunctions[name as NextFunctionName]
      // console.log(e.getValueDeclaration());
    }
  })
  return foundFunctions
}
