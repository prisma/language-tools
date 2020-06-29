import { TextDocument } from 'vscode-languageserver-textdocument'
import {
  CodeActionParams,
  CodeAction,
  Diagnostic,
  DiagnosticSeverity,
  CodeActionKind,
  Range,
} from 'vscode-languageserver'
import { isNullOrUndefined } from 'util'
import { getAllRelationNames } from './completion/completions'
import { convertDocumentTextToTrimmedLineArray } from './MessageHandler'

function insertModelOrEnumAtRange(document: TextDocument): Range {
  // to insert text into a document create a range where start === end.
  const start = { line: document.lineCount, character: 0 }
  return { start: start, end: start }
}

/**
 * Calculates the Levenshtein Distance
 * https://en.wikipedia.org/wiki/Levenshtein_distance
 * adapted from https://leetcode.com/problems/edit-distance/discuss/25846/C%2B%2B-O(n)-space-DP
 */
function levenshtein(word1: string, word2: string): number {
  const m = word1.length
  const n = word2.length
  let pre = 0

  const dp = Array(n + 1).fill(0)
  for (let j = 1; j <= n; j++) {
    dp[j] = j
  }

  for (let i = 1; i <= m; i++) {
    pre = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      let tmp = dp[j]
      if (word1[i - 1] == word2[j - 1]) {
        dp[j] = pre
      } else {
        dp[j] = Math.min(pre, Math.min(dp[j - 1])) + 1
      }
      pre = tmp
    }
  }
  return dp[n]
}

/**
 * Given a name and a list of symbols whose names are *not* equal to the name, return a spelling suggestion if there is one that is close enough.
 * Names less than length 3 only check for case-insensitive equality, not levenshtein distance.
 *
 * If there is a candidate that's the same except for case, return that.
 * If there is a candidate that's within one edit of the name, return that.
 * Otherwise, return the candidate with the smallest Levenshtein distance,
 *    except for candidates:
 *      * With no name
 *      * Whose meaning doesn't match the `meaning` parameter.
 *      * Whose length differs from the target name by more than 0.34 of the length of the name.
 *      * Whose levenshtein distance is more than 0.4 of the length of the name
 *        (0.4 allows 1 substitution/transposition for every 5 characters,
 *         and 1 insertion/deletion at 3 characters)
 */
function getSpellingSuggestionForModelAndEnumName(
  name: string,
  relations: string[],
): string | undefined {
  const maximumLengthDifference = Math.min(2, Math.floor(name.length * 0.34))
  let bestDistance = Math.floor(name.length * 0.4) + 1 // If the best result isn't better than this, don't bother.
  let bestCandidate: string | undefined
  let justCheckExactMatches = false
  const nameLowerCase = name.toLowerCase()
  for (const candidate of relations) {
    if (
      !(
        Math.abs(candidate.length - nameLowerCase.length) <=
        maximumLengthDifference
      )
    ) {
      continue
    }
    const candidateNameLowerCase = candidate.toLowerCase()
    if (candidateNameLowerCase === nameLowerCase) {
      return candidate
    }
    if (justCheckExactMatches) {
      continue
    }
    if (candidate.length < 3) {
      // Don't bother, user would have noticed a 2-character name having an extra character
      continue
    }
    // Only care about a result better than the best so far.
    const distance = levenshtein(nameLowerCase, candidateNameLowerCase)
    if (distance > bestDistance) {
      continue
    }
    if (distance < 3) {
      justCheckExactMatches = true
      bestCandidate = candidate
    } else {
      bestDistance = distance
      bestCandidate = candidate
    }
  }
  return bestCandidate
}

export function quickFix(
  textDocument: TextDocument,
  params: CodeActionParams,
): CodeAction[] {
  const lines: string[] = convertDocumentTextToTrimmedLineArray(textDocument)
  const diagnostics: Diagnostic[] = params.context.diagnostics

  if (isNullOrUndefined(diagnostics) || diagnostics.length === 0) {
    return []
  }

  const codeActions: CodeAction[] = []

  diagnostics.forEach((diag) => {
    if (
      diag.severity === DiagnosticSeverity.Error &&
      diag.message.startsWith('Type') &&
      diag.message.includes(
        'is neither a built-in type, nor refers to another model, custom type, or enum.',
      )
    ) {
      const diagText = textDocument.getText(diag.range)
      const spellingSuggestion = getSpellingSuggestionForModelAndEnumName(
        diagText,
        getAllRelationNames(lines),
      )
      if (spellingSuggestion) {
        codeActions.push({
          title: "Change spelling to '" + spellingSuggestion + "'",
          kind: CodeActionKind.QuickFix,
          diagnostics: [diag],
          edit: {
            changes: {
              [params.textDocument.uri]: [
                {
                  range: diag.range,
                  newText: spellingSuggestion,
                },
              ],
            },
          },
        })
      }
      codeActions.push({
        title: 'Make this relation and create model',
        kind: CodeActionKind.QuickFix,
        diagnostics: [diag],
        edit: {
          changes: {
            [params.textDocument.uri]: [
              {
                range: insertModelOrEnumAtRange(textDocument),
                newText: '\nmodel ' + diagText + ' {\n\n}\n',
              },
            ],
          },
        },
      })
      codeActions.push({
        title: 'Make this relation and create enum',
        kind: CodeActionKind.QuickFix,
        diagnostics: [diag],
        edit: {
          changes: {
            [params.textDocument.uri]: [
              {
                range: insertModelOrEnumAtRange(textDocument),
                newText: '\nenum ' + diagText + ' {\n\n}\n',
              },
            ],
          },
        },
      })
      return
    }
  })

  return codeActions
}
