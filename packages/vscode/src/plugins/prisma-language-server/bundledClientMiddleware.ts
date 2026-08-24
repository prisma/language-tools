import type { CodeAction, Command, CompletionItem, CompletionList, ProviderResult, TextDocument, Uri } from 'vscode'
import type {
  CodeAction as ProtocolCodeAction,
  Command as ProtocolCommand,
  TextDocumentIdentifier,
} from 'vscode-languageclient'
import type { LanguageClient, Middleware } from 'vscode-languageclient/node'
import { DocumentOwnershipCoordinator } from './documentOwnership'

export interface BundledClientMiddlewareOptions {
  readonly ownership: DocumentOwnershipCoordinator
  readonly getClient: () => LanguageClient
  readonly getDocument: (uri: Uri) => TextDocument | undefined
  readonly handleDiagnosticMessage: (message: string) => void
  readonly isSnippetEdit: (action: ProtocolCodeAction, document: TextDocumentIdentifier) => boolean
}

export interface BundledClientMiddleware extends Middleware {
  openDocument(document: TextDocument): void
  closeDocument(document: TextDocument): void
  clearDiagnostics(uri: Uri): void
  resetClientState(): void
}

export function createBundledClientMiddleware(options: BundledClientMiddlewareOptions): BundledClientMiddleware {
  let completionDocuments = new WeakMap<CompletionItem, TextDocument>()
  const bundledDocuments = new Set<string>()

  const isBundledDocument = (document: TextDocument): boolean => {
    const committedOwner = options.ownership.getOwner(document.uri)
    const currentOwner = options.ownership.classify(document)
    return committedOwner.kind === 'bundled' && currentOwner.kind === 'bundled'
  }

  const clearDiagnostics = (uri: Uri): void => {
    options.getClient().diagnostics?.delete(uri)
  }

  const openBundledDocument = (document: TextDocument): void => {
    const documentUri = document.uri.toString()
    if (bundledDocuments.has(documentUri)) return

    bundledDocuments.add(documentUri)
    const client = options.getClient()
    try {
      client.sendNotification('textDocument/didOpen', client.code2ProtocolConverter.asOpenTextDocumentParams(document))
    } catch (error) {
      bundledDocuments.delete(documentUri)
      throw error
    }
  }

  const closeBundledDocument = (document: TextDocument): void => {
    const documentUri = document.uri.toString()
    if (!bundledDocuments.delete(documentUri)) return

    const client = options.getClient()
    try {
      client.sendNotification(
        'textDocument/didClose',
        client.code2ProtocolConverter.asCloseTextDocumentParams(document),
      )
    } catch (error) {
      bundledDocuments.add(documentUri)
      throw error
    }
  }

  const middleware: BundledClientMiddleware = {
    openDocument: openBundledDocument,
    closeDocument: closeBundledDocument,
    clearDiagnostics,
    resetClientState: () => {
      bundledDocuments.clear()
      completionDocuments = new WeakMap()
    },
    didOpen: (document, next) => {
      const documentUri = document.uri.toString()
      if (isBundledDocument(document) && !bundledDocuments.has(documentUri)) {
        bundledDocuments.add(documentUri)
        next(document)
      }
    },
    didChange: (event, next) => {
      const document = event.document
      if (isBundledDocument(document) && bundledDocuments.has(document.uri.toString())) {
        next(event)
      }
    },
    didClose: (document, next) => {
      void options.ownership.synchronize(document)
      if (bundledDocuments.delete(document.uri.toString())) {
        next(document)
      }
      clearDiagnostics(document.uri)
    },
    handleDiagnostics: (uri, diagnostics, next) => {
      const document = options.getDocument(uri)
      const isOwned = document ? isBundledDocument(document) : options.ownership.getOwner(uri).kind === 'bundled'
      if (!isOwned) {
        next(uri, [])
        return
      }

      for (const diagnostic of diagnostics) {
        options.handleDiagnosticMessage(diagnostic.message)
      }
      next(uri, diagnostics)
    },
    provideCompletionItem: (document, position, context, token, next) => {
      if (!isBundledDocument(document)) {
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
      if (!document || !isBundledDocument(document)) {
        return undefined
      }
      return next(item, token)
    },
    provideHover: (document, position, token, next) =>
      isBundledDocument(document) ? next(document, position, token) : undefined,
    provideDefinition: (document, position, token, next) =>
      isBundledDocument(document) ? next(document, position, token) : undefined,
    provideReferences: (document, position, referenceContext, token, next) =>
      isBundledDocument(document) ? next(document, position, referenceContext, token) : undefined,
    provideDocumentSymbols: (document, token, next) =>
      isBundledDocument(document) ? next(document, token) : undefined,
    provideDocumentFormattingEdits: (document, formattingOptions, token, next) =>
      isBundledDocument(document) ? next(document, formattingOptions, token) : undefined,
    provideRenameEdits: (document, position, newName, token, next) =>
      isBundledDocument(document) ? next(document, position, newName, token) : undefined,
    provideCodeActions: async (document, range, context, token) => {
      if (!isBundledDocument(document)) {
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
