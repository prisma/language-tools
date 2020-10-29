import { ArrowFunction, FunctionDeclaration } from 'ts-morph'
import { NextFunctionName, NextFunctionType } from './constants'

export function addTSType(
  node: ArrowFunction | FunctionDeclaration,
  foundNextFunctions: NextFunctionType,
): void {
  const typeString = buildTypeString(foundNextFunctions)

  const params = node.getParameters()
  const param = params[0]
  if (!params || params.length === 0) {
    node.addParameter({
      name: 'props',
      type: typeString,
    })
  } else if (params.length === 1) {
    node.addParameter({
      name: param.getName(),
      type: typeString,
    })
    param.remove()
  }
  // The case for adding types when multiple params are present
  // is not currently possible with ts-morph
}
function buildTypeString(foundNextFunctions: NextFunctionType) {
  return Object.keys(foundNextFunctions).reduce((acc, functionName) => {
    const type = foundNextFunctions[functionName as NextFunctionName].type
    if (acc) {
      acc += ` & ${type}`
    } else {
      acc = type
    }
    return acc
  }, '')
}
