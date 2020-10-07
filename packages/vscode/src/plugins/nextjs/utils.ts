import path from 'path'
import { SourceFile } from 'ts-morph'
import { NextFunctionName, NextFunctions, NextFunctionType } from './constants'

export function isJS(sourceFile: SourceFile): boolean {
  const filePath = sourceFile.getFilePath()
  const extension = path.extname(filePath)
  return extension.includes('js')
}
/**
 * Reads a source file and finds which special nextJS functions are being used.
 * i.e `getServerSideProps` | `getStaticProps`
 */
export function getUsedNextFunctions(sourceFile: SourceFile): NextFunctionType {
  const exports = sourceFile?.getSymbol()?.getExports()
  const foundFunctions = {} as NextFunctionType
  exports?.forEach((e) => {
    const name = e.getName()
    if (Object.keys(NextFunctions).includes(name)) {
      foundFunctions[name as NextFunctionName] =
        NextFunctions[name as NextFunctionName]
    }
  })
  return foundFunctions
}
