import { CompletionItem, CompletionItemKind } from 'vscode-languageserver'

import { convertAttributesToCompletionItems } from '../internals'

import * as completions from '../completions.json'

export const blockAttributes: CompletionItem[] = convertAttributesToCompletionItems(
  completions.blockAttributes,
  CompletionItemKind.Property,
)
