import type { CompletionItem, CompletionList, ProviderResult, TextDocument, Uri } from 'vscode'
import type { LanguageClient, Middleware } from 'vscode-languageclient/node'
import type { DocumentOwnershipCoordinator } from './documentOwnership'

export interface PrismaNextClientMiddlewareOptions {
  readonly workspaceFolderUri: string
  readonly ownership: DocumentOwnershipCoordinator
  readonly isActive: () => boolean
  readonly getClient: () => LanguageClient
  readonly getDocument: (uri: Uri) => TextDocument | undefined
}

export interface PrismaNextClientMiddleware extends Middleware {
  openDocument(document: TextDocument): void
  closeDocument(document: TextDocument): void
  clearDiagnostics(uri: Uri): void
}

export function createPrismaNextClientMiddleware(
  options: PrismaNextClientMiddlewareOptions,
): PrismaNextClientMiddleware {
  const synchronizedDocuments = new Set<string>()
  const completionDocuments = new WeakMap<CompletionItem, TextDocument>()

  const isOwnedDocument = (document: TextDocument): boolean => {
    if (!options.isActive()) return false

    const settledOwner = options.ownership.getSettledOwner(document.uri)
    const desiredOwner = options.ownership.getDesiredOwner(document)
    return (
      settledOwner.kind === 'prisma-next' &&
      desiredOwner.kind === 'prisma-next' &&
      settledOwner.workspaceFolderUri === options.workspaceFolderUri &&
      desiredOwner.workspaceFolderUri === options.workspaceFolderUri
    )
  }

  const clearDiagnostics = (uri: Uri): void => {
    if (!options.isActive()) return
    options.getClient().diagnostics?.delete(uri)
  }

  const openDocument = (document: TextDocument): void => {
    if (!options.isActive()) return

    const documentUri = document.uri.toString()
    if (synchronizedDocuments.has(documentUri)) return

    synchronizedDocuments.add(documentUri)
    const client = options.getClient()
    try {
      client.sendNotification('textDocument/didOpen', client.code2ProtocolConverter.asOpenTextDocumentParams(document))
    } catch (error) {
      synchronizedDocuments.delete(documentUri)
      throw error
    }
  }

  const closeDocument = (document: TextDocument): void => {
    if (!options.isActive()) return

    const documentUri = document.uri.toString()
    if (!synchronizedDocuments.delete(documentUri)) return

    const client = options.getClient()
    try {
      client.sendNotification(
        'textDocument/didClose',
        client.code2ProtocolConverter.asCloseTextDocumentParams(document),
      )
    } catch (error) {
      synchronizedDocuments.add(documentUri)
      throw error
    }
  }

  const middleware: PrismaNextClientMiddleware = {
    openDocument,
    closeDocument,
    clearDiagnostics,
    didOpen: (document, next) => {
      const documentUri = document.uri.toString()
      if (isOwnedDocument(document) && !synchronizedDocuments.has(documentUri)) {
        synchronizedDocuments.add(documentUri)
        try {
          next(document)
        } catch (error) {
          synchronizedDocuments.delete(documentUri)
          throw error
        }
      }
    },
    didChange: (event, next) => {
      if (isOwnedDocument(event.document) && synchronizedDocuments.has(event.document.uri.toString())) {
        next(event)
      }
    },
    didClose: (document, next) => {
      const documentUri = document.uri.toString()
      if (synchronizedDocuments.delete(documentUri)) {
        try {
          next(document)
        } catch (error) {
          synchronizedDocuments.add(documentUri)
          throw error
        }
      }
      clearDiagnostics(document.uri)
    },
    handleDiagnostics: (uri, diagnostics, next) => {
      const document = options.getDocument(uri)
      if (!document || !isOwnedDocument(document)) {
        next(uri, [])
        return
      }
      next(uri, diagnostics)
    },
    provideCompletionItem: (document, position, context, token, next) => {
      if (!isOwnedDocument(document)) return undefined
      return mapProviderResult(next(document, position, context, token), (result) => {
        for (const item of completionItems(result)) {
          completionDocuments.set(item, document)
        }
        return result
      })
    },
    resolveCompletionItem: (item, token, next) => {
      const document = completionDocuments.get(item)
      return document && isOwnedDocument(document) ? next(item, token) : undefined
    },
    provideHover: (document, position, token, next) =>
      isOwnedDocument(document) ? next(document, position, token) : undefined,
    provideDefinition: (document, position, token, next) =>
      isOwnedDocument(document) ? next(document, position, token) : undefined,
    provideReferences: (document, position, context, token, next) =>
      isOwnedDocument(document) ? next(document, position, context, token) : undefined,
    provideDocumentSymbols: (document, token, next) => (isOwnedDocument(document) ? next(document, token) : undefined),
    provideDocumentFormattingEdits: (document, formattingOptions, token, next) =>
      isOwnedDocument(document) ? next(document, formattingOptions, token) : undefined,
    provideRenameEdits: (document, position, newName, token, next) =>
      isOwnedDocument(document) ? next(document, position, newName, token) : undefined,
    provideCodeActions: (document, range, context, token, next) =>
      isOwnedDocument(document) ? next(document, range, context, token) : undefined,
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
