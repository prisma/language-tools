import { Diagnostic, DiagnosticSeverity, Range, DiagnosticTag } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { getBlockAtPosition, getExperimentalFeaturesRange } from './ast'
import { MAX_SAFE_VALUE_i32 } from './constants'

// TODO (Joël) can be removed? Since it was renamed to `previewFeatures`
// check for experimentalFeatures inside generator block
// Related code in codeActionProvider.ts, around lines 185-204
export const validateExperimentalFeatures = (document: TextDocument, diagnostics: Diagnostic[]) => {
  if (document.getText().includes('experimentalFeatures')) {
    const experimentalFeaturesRange: Range | undefined = getExperimentalFeaturesRange(document)
    if (experimentalFeaturesRange) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: experimentalFeaturesRange,
        message:
          "The `experimentalFeatures` property is obsolete and has been renamed to 'previewFeatures' to better communicate what it is.",
        code: 'Prisma 5',
        tags: [2],
      })
    }
  }
}

export const validateIgnoredBlocks = (lines: string[], diagnostics: Diagnostic[]) => {
  lines.map((currElement, index) => {
    if (currElement.includes('@@ignore')) {
      const block = getBlockAtPosition(index, lines)
      if (block) {
        diagnostics.push({
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
    } else if (currElement.includes('@ignore')) {
      diagnostics.push({
        range: {
          start: { line: index, character: 0 },
          end: { line: index, character: MAX_SAFE_VALUE_i32 },
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
