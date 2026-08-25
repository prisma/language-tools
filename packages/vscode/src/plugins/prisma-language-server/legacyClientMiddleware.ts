import type { CodeAction, Command, CompletionItem, CompletionList, ProviderResult, TextDocument, Uri } from 'vscode'
import type {
  CodeAction as ProtocolCodeAction,
  Command as ProtocolCommand,
  TextDocumentIdentifier,
} from 'vscode-languageclient'
import type { LanguageClient, Middleware } from 'vscode-languageclient/node'
import { DocumentOwnershipCoordinator } from './documentOwnership'

export interface LegacyClientMiddlewareOptions {
  readonly ownership: DocumentOwnershipCoordinator
  readonly getClient: () => LanguageClient
  readonly getDocument: (uri: Uri) => TextDocument | undefined
  readonly handleDiagnosticMessage: (message: string) => void
  readonly isSnippetEdit: (action: ProtocolCodeAction, document: TextDocumentIdentifier) => boolean
}

export interface LegacyClientMiddleware extends Middleware {
  openDocument(document: TextDocument): void
  closeDocument(document: TextDocument): void
  clearDiagnostics(uri: Uri): void
  resetClientState(): void
}

export function createLegacyClientMiddleware(options: LegacyClientMiddlewareOptions): LegacyClientMiddleware {
  let completionDocuments = new WeakMap<CompletionItem, TextDocument>()
  const legacyDocuments = new Set<string>()

  const isLegacyDocument = (document: TextDocument): boolean => {
    const settledOwner = options.ownership.getSettledOwner(document.uri)
    const desiredOwner = options.ownership.getDesiredOwner(document)
    return settledOwner.kind === 'legacy' && desiredOwner.kind === 'legacy'
  }

  const clearDiagnostics = (uri: Uri): void => {
    options.getClient().diagnostics?.delete(uri)
  }

  const openLegacyDocument = (document: TextDocument): void => {
    const documentUri = document.uri.toString()
    if (legacyDocuments.has(documentUri)) return

    legacyDocuments.add(documentUri)
    const client = options.getClient()
    try {
      client.sendNotification('textDocument/didOpen', client.code2ProtocolConverter.asOpenTextDocumentParams(document))
    } catch (error) {
      legacyDocuments.delete(documentUri)
      throw error
    }
  }

  const closeLegacyDocument = (document: TextDocument): void => {
    const documentUri = document.uri.toString()
    if (!legacyDocuments.delete(documentUri)) return

    const client = options.getClient()
    try {
      client.sendNotification(
        'textDocument/didClose',
        client.code2ProtocolConverter.asCloseTextDocumentParams(document),
      )
    } catch (error) {
      legacyDocuments.add(documentUri)
      throw error
    }
  }

  const middleware: LegacyClientMiddleware = {
    openDocument: openLegacyDocument,
    closeDocument: closeLegacyDocument,
    clearDiagnostics,
    resetClientState: () => {
      legacyDocuments.clear()
      completionDocuments = new WeakMap()
    },
    didOpen: (document, next) => {
      const documentUri = document.uri.toString()
      if (isLegacyDocument(document) && !legacyDocuments.has(documentUri)) {
        legacyDocuments.add(documentUri)
        try {
          next(document)
        } catch (error) {
          legacyDocuments.delete(documentUri)
          throw error
        }
      }
    },
    didChange: (event, next) => {
      const document = event.document
      if (isLegacyDocument(document) && legacyDocuments.has(document.uri.toString())) {
        next(event)
      }
    },
    didClose: (document, next) => {
      const documentUri = document.uri.toString()
      if (legacyDocuments.delete(documentUri)) {
        try {
          next(document)
        } catch (error) {
          legacyDocuments.add(documentUri)
          throw error
        }
      }
      clearDiagnostics(document.uri)
    },
    handleDiagnostics: (uri, diagnostics, next) => {
      const document = options.getDocument(uri)
      if (!document || !isLegacyDocument(document)) {
        next(uri, [])
        return
      }

      for (const diagnostic of diagnostics) {
        options.handleDiagnosticMessage(diagnostic.message)
      }
      next(uri, diagnostics)
    },
    provideCompletionItem: (document, position, context, token, next) => {
      if (!isLegacyDocument(document)) {
        return undefined
      }

      return mapProviderResult(next(document, position, context, token), (result) => {
        for (const item of completionItems(result)) {
          completionDocuments.set(item, document)
        }
        return result
      })
    },
    resolveCompletionItem: (item, token, next) => {
      const document = completionDocuments.get(item)
      if (!document || !isLegacyDocument(document)) {
        return undefined
      }
      return next(item, token)
    },
    provideHover: (document, position, token, next) =>
      isLegacyDocument(document) ? next(document, position, token) : undefined,
    provideDefinition: (document, position, token, next) =>
      isLegacyDocument(document) ? next(document, position, token) : undefined,
    provideReferences: (document, position, referenceContext, token, next) =>
      isLegacyDocument(document) ? next(document, position, referenceContext, token) : undefined,
    provideDocumentSymbols: (document, token, next) => (isLegacyDocument(document) ? next(document, token) : undefined),
    provideDocumentFormattingEdits: (document, formattingOptions, token, next) =>
      isLegacyDocument(document) ? next(document, formattingOptions, token) : undefined,
    provideRenameEdits: (document, position, newName, token, next) =>
      isLegacyDocument(document) ? next(document, position, newName, token) : undefined,
    provideCodeActions: async (document, range, context, token) => {
      if (!isLegacyDocument(document)) {
        return undefined
      }

      const client = options.getClient()
      const documentIdentifier = client.code2ProtocolConverter.asTextDocumentIdentifier(document)
      const params = {
        textDocument: documentIdentifier,
        range: client.code2ProtocolConverter.asRange(range),
        context: client.code2ProtocolConverter.asCodeActionContext(context),
      }

      return client
        .sendRequest<(ProtocolCodeAction | ProtocolCommand)[] | null>('textDocument/codeAction', params, token)
        .then(
          (values) => {
            if (values === null) return undefined
            const result: (CodeAction | Command)[] = []
            for (const item of values) {
              if (isProtocolCodeAction(item)) {
                const action = client.protocol2CodeConverter.asCodeAction(item)
                if (options.isSnippetEdit(item, documentIdentifier) && item.edit !== undefined) {
                  action.command = {
                    command: 'prisma.applySnippetWorkspaceEdit',
                    title: '',
                    arguments: [action.edit],
                  }
                  action.edit = undefined
                }
                result.push(action)
              } else {
                result.push(client.protocol2CodeConverter.asCommand(item))
              }
            }
            return result
          },
          () => undefined,
        )
    },
  }

  return middleware
}

function completionItems(result: CompletionItem[] | CompletionList | undefined | null): CompletionItem[] {
  if (!result) return []
  return Array.isArray(result) ? result : result.items
}

function mapProviderResult<T>(
  result: ProviderResult<T>,
  map: (value: T | undefined | null) => T | undefined | null,
): ProviderResult<T> {
  return Promise.resolve(result).then(map)
}

function isProtocolCodeAction(item: ProtocolCodeAction | ProtocolCommand): item is ProtocolCodeAction {
  return typeof item.command !== 'string'
}
