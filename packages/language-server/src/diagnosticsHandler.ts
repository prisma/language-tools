import { TextDocument } from 'vscode-languageserver-textdocument'
import {
  Diagnostic,
  DiagnosticSeverity,
  Range,
} from 'vscode-languageserver/node'
import {
  convertDocumentTextToTrimmedLineArray,
  getCurrentLine,
} from './MessageHandler'
import { LinterError } from './prisma-fmt/lint'

export function greyOutIgnoredFields(document: TextDocument): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  return diagnostics
}

export function checkForPrisma1Model(linterErrors: LinterError[]): boolean {
  return linterErrors.some(
    (diagnostic) =>
      diagnostic.text === "Field declarations don't require a `:`." ||
      diagnostic.text ===
        'Model declarations have to be indicated with the `model` keyword.',
  )
}

export function transformLinterErrorsToDiagnostics(
  linterErrors: LinterError[],
  document: TextDocument,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  for (const diag of linterErrors) {
    const diagnostic: Diagnostic = {
      range: {
        start: document.positionAt(diag.start),
        end: document.positionAt(diag.end),
      },
      message: diag.text,
      source: '',
    }
    if (diag.is_warning) {
      diagnostic.severity = DiagnosticSeverity.Warning
    } else {
      diagnostic.severity = DiagnosticSeverity.Error
    }
    diagnostics.push(diagnostic)
  }
  return diagnostics
}

export function checkForExperimentalFeaturesUSeage(
  document: TextDocument,
): Range | undefined {
  if (document.getText().includes('experimentalFeatures')) {
    const experimentalFeaturesRange:
      | Range
      | undefined = getExperimentalFeaturesRange(document)
    return experimentalFeaturesRange
  }
}

function getExperimentalFeaturesRange(
  document: TextDocument,
): Range | undefined {
  const lines = convertDocumentTextToTrimmedLineArray(document)
  const experimentalFeatures = 'experimentalFeatures'
  let reachedStartLine = false
  for (const [key, item] of lines.entries()) {
    if (item.startsWith('generator') && item.includes('{')) {
      reachedStartLine = true
    }
    if (!reachedStartLine) {
      continue
    }
    if (reachedStartLine && item.startsWith('}')) {
      return
    }

    if (item.startsWith(experimentalFeatures)) {
      const startIndex = getCurrentLine(document, key).indexOf(
        experimentalFeatures,
      )
      return {
        start: { line: key, character: startIndex },
        end: { line: key, character: startIndex + experimentalFeatures.length },
      }
    }
  }
}
