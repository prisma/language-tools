import { DiagnosticSeverity, DiagnosticTag } from 'vscode-languageserver'

import { getBlockAtPosition } from './ast'
import { MAX_SAFE_VALUE_i32 } from './constants'
import { PrismaSchema } from './Schema'
import { DiagnosticMap } from './DiagnosticMap'

export const validateIgnoredBlocks = (schema: PrismaSchema, diagnostics: DiagnosticMap) => {
  schema.linesAsArray().map(({ document, lineIndex, text }) => {
    if (text.includes('@@ignore')) {
      const block = getBlockAtPosition(document.uri, lineIndex, schema)
      if (block) {
        diagnostics.add(document.uri, {
          range: { start: block.range.start, end: block.range.end },
          message:
            '@@ignore: When using Prisma Migrate, this model will be kept in sync with the database schema, however, it will not be exposed in Prisma Client.',
          tags: [DiagnosticTag.Unnecessary],
          severity: DiagnosticSeverity.Hint,
          code: '@@ignore documentation',
          codeDescription: {
            href: 'https://pris.ly/d/schema-reference#ignore-1',
          },
        })
      }
    } else if (text.includes('@ignore')) {
      diagnostics.add(document.uri, {
        range: {
          start: { line: lineIndex, character: 0 },
          end: { line: lineIndex, character: MAX_SAFE_VALUE_i32 },
        },
        message:
          '@ignore: When using Prisma Migrate, this field will be kept in sync with the database schema, however, it will not be exposed in Prisma Client.',
        tags: [DiagnosticTag.Unnecessary],
        severity: DiagnosticSeverity.Hint,
        code: '@ignore documentation',
        codeDescription: {
          href: 'https://pris.ly/d/schema-reference#ignore',
        },
      })
    }
  })
}
