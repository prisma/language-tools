import {
  ArrowFunction,
  FunctionDeclaration,
  SourceFile,
  TypeGuards,
} from 'ts-morph'
import { NextFunctionName, NextFunctionType } from './constants'

function buildJSDocType(base: string, paramName: string) {
  return `{import('next').${base} } ${paramName}`
}
function addType(
  node: ArrowFunction | FunctionDeclaration,
  foundNextFunctions: NextFunctionType,
) {
  const functionNames = Object.keys(foundNextFunctions) as NextFunctionName[]
  if (functionNames && functionNames.length !== 0) {
    const params = node.getParameters()
    const param = params[0]
    const typeString = foundNextFunctions[functionNames[0]].type
    const jsDocType = buildJSDocType(typeString, 'props')
    if (
      TypeGuards.isFunctionDeclaration(node) &&
      node.getJsDocs().length === 0
    ) {
      if (!param) {
        node.addParameter({
          name: 'props',
        })
      }
      node.addJsDoc({
        tags: [
          {
            tagName: 'param',
            text: jsDocType,
          },
        ],
      })
    }
  }
}
// TODO Refactor as suggested by Carmen
export function addJSDoc(
  sourceFile: SourceFile,
  foundNextFunctions: NextFunctionType,
): void {
  const defaultExportSymbol = sourceFile.getDefaultExportSymbol()

  if (defaultExportSymbol) {
    // you will need to handle more scenarios than what's shown here
    const declaration = defaultExportSymbol.getDeclarations()[0]
    if (!declaration) return

    if (TypeGuards.isFunctionDeclaration(declaration)) {
      addType(declaration, foundNextFunctions)
    } else if (TypeGuards.isExportAssignment(declaration)) {
      const expr = declaration.getExpression()

      if (TypeGuards.isArrowFunction(expr)) {
        addType(expr, foundNextFunctions)
      } else if (TypeGuards.isIdentifier(expr)) {
        const node = expr
          .findReferences()[0]
          ?.getDefinition()
          .getDeclarationNode()
        const child = node?.getLastChild()

        if (
          TypeGuards.isFunctionDeclaration(node) ||
          TypeGuards.isArrowFunction(node)
        ) {
          addType(node, foundNextFunctions)
        } else if (
          TypeGuards.isArrowFunction(child) ||
          TypeGuards.isFunctionDeclaration(child)
        ) {
          addType(child, foundNextFunctions)
        } else {
          console.log('Unhandled Case 1', child?.getKindName())
        }
      } else {
        console.log('Unhandled Case 2', expr.getKindName())
      }
    } else {
      console.log('Unhandled Case 3', declaration.getKindName())
    }
  }
}
