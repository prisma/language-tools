import {
  DocumentFormattingEditProvider,
  Range,
  TextDocument,
  FormattingOptions,
  CancellationToken,
  TextEdit,
} from 'vscode'

import format from './format'

export function fullDocumentRange(document: TextDocument): Range {
  const lastLineId = document.lineCount - 1
  return new Range(0, 0, lastLineId, document.lineAt(lastLineId).text.length)
}

class PrismaEditProvider implements DocumentFormattingEditProvider {
  constructor(private readonly binPath: string) {}

  provideDocumentFormattingEdits(
    document: TextDocument,
    options: FormattingOptions,
    token: CancellationToken,
  ): Promise<TextEdit[]> {
    return format(
      this.binPath,
      options.tabSize,
      document.getText(),
    ).then(formatted => [
      TextEdit.replace(fullDocumentRange(document), formatted),
    ])
  }
}

export default PrismaEditProvider
