import { ArrowFunction, FunctionDeclaration } from 'ts-morph'
import { NextFunctionName, NextFunctionType } from './constants'

export function addTSType(
  node: ArrowFunction | FunctionDeclaration,
  foundNextFunctions: NextFunctionType,
): void {
  const typeString = buildTypeString(foundNextFunctions)

  const params = node.getParameters()
  const param = params[0]
  if (param) {
    node.addParameter({
      name: param.getName(),
      type: typeString,
    })
    param.remove()
  } else {
    node.addParameter({
      name: 'props',
      type: typeString,
    })
  }
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
