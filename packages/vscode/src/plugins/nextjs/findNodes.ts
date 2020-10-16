import {
  ArrowFunction,
  FunctionDeclaration,
  SourceFile,
  TypeGuards,
} from 'ts-morph'
import { NextFunctionType } from './constants'
/**
 * This finds the relevant ast nodes to add the types to
 * @param sourceFile
 * @param foundNextFunctions
 * @param callback
 */
export function findNodes(
  sourceFile: SourceFile,
  foundNextFunctions: NextFunctionType,
  addTypes: (
    node: ArrowFunction | FunctionDeclaration,
    foundNextFunctions: NextFunctionType,
  ) => void,
): void {
  const defaultExportSymbol = sourceFile.getDefaultExportSymbol()
  if (defaultExportSymbol) {
    // you will need to handle more scenarios than what's shown here
    const declaration = defaultExportSymbol.getDeclarations()[0]
    if (!declaration) return

    if (TypeGuards.isFunctionDeclaration(declaration)) {
      addTypes(declaration, foundNextFunctions)
    } else if (TypeGuards.isExportAssignment(declaration)) {
      const expr = declaration.getExpression()

      if (TypeGuards.isArrowFunction(expr)) {
        addTypes(expr, foundNextFunctions)
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
          addTypes(node, foundNextFunctions)
        } else if (
          TypeGuards.isArrowFunction(child) ||
          TypeGuards.isFunctionDeclaration(child)
        ) {
          addTypes(child, foundNextFunctions)
        }
      }
    }
  }
}
