import { TextDocument } from "vscode-languageserver-textdocument";
import { CodeActionParams, CodeAction, Diagnostic, DiagnosticSeverity, CodeActionKind, Range } from "vscode-languageserver";
import { isNullOrUndefined } from "util";

function insertModelOrEnumAtRange(document: TextDocument): Range {
  // to insert text into a document create a range where start === end.
  const start = { line: document.lineCount, character: 0 }
  return { start: start, end: start }
}

export function quickFix(textDocument: TextDocument, params: CodeActionParams): CodeAction[] {
  const diagnostics: Diagnostic[] = params.context.diagnostics

  if (isNullOrUndefined(diagnostics) || diagnostics.length === 0) {
    return [];
  }

  const codeActions: CodeAction[] = []

  diagnostics.forEach((diag) => {
    if (diag.severity === DiagnosticSeverity.Error && diag.message.startsWith('Type') && diag.message.includes('is neither a built-in type, nor refers to another model, custom type, or enum.')) {
      codeActions.push({
        title: "Make this relation and create model",
        kind: CodeActionKind.QuickFix,
        diagnostics: [diag],
        edit: {
          changes: {
            [params.textDocument.uri]: [{
              range: insertModelOrEnumAtRange(textDocument), newText: '\nmodel ' + textDocument.getText(diag.range) + ' {\n\n}\n'
            }]
          }
        }
      });
      codeActions.push({
        title: "Make this relation and create enum",
        kind: CodeActionKind.QuickFix,
        diagnostics: [diag],
        edit: {
          changes: {
            [params.textDocument.uri]: [{
              range: insertModelOrEnumAtRange(textDocument), newText: '\nenum ' + textDocument.getText(diag.range) + ' {\n\n}\n'
            }]
          }
        }
      });
      return;
    }
  })

  return codeActions
}