import type { CodeAction, Command, CompletionItem, CompletionList, ProviderResult, TextDocument, Uri } from 'vscode'
import type {
  CodeAction as ProtocolCodeAction,
  Command as ProtocolCommand,
  TextDocumentIdentifier,
} from 'vscode-languageclient'
import type { LanguageClient, Middleware } from 'vscode-languageclient/node'
import { DocumentOwnershipCoordinator, type DocumentOwner } from './documentOwnership'

export interface BundledClientMiddlewareOptions {
  readonly ownership: DocumentOwnershipCoordinator
  readonly getClient: () => LanguageClient
  readonly getDocument: (uri: Uri) => TextDocument | undefined
  readonly handleDiagnosticMessage: (message: string) => void
  readonly isSnippetEdit: (action: ProtocolCodeAction, document: TextDocumentIdentifier) => boolean
}

export interface BundledClientMiddleware extends Middleware {
  resetClientState(): void
}

export function createBundledClientMiddleware(options: BundledClientMiddlewareOptions): BundledClientMiddleware {
  let completionDocuments = new WeakMap<CompletionItem, TextDocument>()
  const bundledDocuments = new Set<string>()

  const ownerForDocument = (document: TextDocument): DocumentOwner => {
    void options.ownership.synchronize(document)
    return options.ownership.classify(document)
  }

  const isBundledDocument = (document: TextDocument): boolean => ownerForDocument(document).kind === 'bundled'

  const clearDiagnostics = (uri: Uri): void => {
    options.getClient().diagnostics?.delete(uri)
  }

  const openBundledDocument = (document: TextDocument): void => {
    const documentUri = document.uri.toString()
    if (bundledDocuments.has(documentUri)) return

    bundledDocuments.add(documentUri)
    const client = options.getClient()
    void client.sendNotification(
      'textDocument/didOpen',
      client.code2ProtocolConverter.asOpenTextDocumentParams(document),
    )
  }

  const closeBundledDocument = (document: TextDocument): void => {
    const documentUri = document.uri.toString()
    if (!bundledDocuments.delete(documentUri)) return

    const client = options.getClient()
    void client.sendNotification(
      'textDocument/didClose',
      client.code2ProtocolConverter.asCloseTextDocumentParams(document),
    )
  }

  const middleware: BundledClientMiddleware = {
    resetClientState: () => {
      bundledDocuments.clear()
      completionDocuments = new WeakMap()
    },
    didOpen: (document, next) => {
      const documentUri = document.uri.toString()
      if (isBundledDocument(document)) {
        if (!bundledDocuments.has(documentUri)) {
          bundledDocuments.add(documentUri)
          next(document)
        }
      } else {
        closeBundledDocument(document)
        clearDiagnostics(document.uri)
      }
    },
    didChange: (event, next) => {
      const document = event.document
      const documentUri = document.uri.toString()
      if (isBundledDocument(document)) {
        if (bundledDocuments.has(documentUri)) {
          next(event)
        } else {
          openBundledDocument(document)
        }
      } else {
        closeBundledDocument(document)
        clearDiagnostics(document.uri)
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
      const owner = document ? ownerForDocument(document) : options.ownership.getOwner(uri)
      if (owner.kind !== 'bundled') {
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
