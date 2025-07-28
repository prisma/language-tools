import { DiagnosticSeverity, DiagnosticTag } from 'vscode-languageserver'

import { getBlockAtPosition, getBlocks } from './ast'
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

export const validateExternalBlocks = (schema: PrismaSchema, diagnostics: DiagnosticMap) => {
  const externalTables = new Set(schema.config?.tables?.external)
  const externalEnums = new Set(schema.config?.enums?.external)

  for (const block of getBlocks(schema)) {
    if (block.type === 'model' || block.type === 'enum') {
      const blockStartOffset = block.definingDocument.textDocument.offsetAt(block.range.start)
      const blockEndOffset = block.definingDocument.textDocument.offsetAt(block.range.end)

      const [, mapped] =
        block.definingDocument.content
          .slice(blockStartOffset, blockEndOffset)
          .match(/^\s*@@map\s*\(\s*['"]([^'"]+)['"]\s*\)/m) ?? []

      const [, schema] =
        block.definingDocument.content
          .slice(blockStartOffset, blockEndOffset)
          .match(/^\s*@@schema\s*\(\s*['"]([^'"]+)['"]\s*\)/m) ?? []

      const name = mapped ? mapped : block.name
      const needle = schema ? `${schema}.${name}` : name
      const haystack = block.type === 'model' ? externalTables : externalEnums

      if (haystack.has(needle)) {
        diagnostics.add(block.definingDocument.uri, {
          range: block.range,
          message: `The ${block.type} "${block.name}" is marked as external in the Prisma config file.`,
          tags: [DiagnosticTag.Unnecessary],
          severity: DiagnosticSeverity.Hint,
        })
      }
    }
  }
}
