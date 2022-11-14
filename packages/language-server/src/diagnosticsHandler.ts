import { Diagnostic, DiagnosticSeverity, DiagnosticTag } from 'vscode-languageserver/node'
import { getBlockAtPosition } from './util'

export function greyOutIgnoredParts(lines: string[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  lines.map((currElement, index) => {
    if (currElement.includes('@@ignore')) {
      const block = getBlockAtPosition(index, lines)
      if (block) {
        diagnostics.push({
          range: { start: block.range.start, end: block.range.end },
          message:
            '@@ignore: this model will be kept in sync with the database schema, however, it won’t be exposed to the Prisma client.',
          tags: [DiagnosticTag.Unnecessary],
          severity: DiagnosticSeverity.Hint,
        })
      }
    } else if (currElement.includes('@ignore')) {
      diagnostics.push({
        range: {
          start: { line: index, character: 0 },
          end: { line: index, character: Number.MAX_VALUE },
        },
        message:
          '@ignore: this field will be kept in sync with the database schema, however, it won’t be exposed to the Prisma client.',
        tags: [DiagnosticTag.Unnecessary],
        severity: DiagnosticSeverity.Hint,
      })
    }
  })

  return diagnostics
}
