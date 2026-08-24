import type { TextDocument, Uri } from 'vscode'
import type { DocumentOwner, DocumentOwnershipCoordinator, PrepareDocumentOwnerCommit } from './documentOwnership'

export interface BundledDocumentSynchronization {
  openDocument(document: TextDocument): void
  closeDocument(document: TextDocument): void
  clearDiagnostics(uri: Uri): void
}

export interface LocalDocumentSynchronization {
  ensureClientForDocument(document: TextDocument): Promise<unknown>
  openDocument(workspaceFolderUri: string, document: TextDocument): Promise<void>
  closeDocument(workspaceFolderUri: string, document: TextDocument): Promise<void>
  clearDiagnostics(workspaceFolderUri: string, uri: Uri): Promise<void>
}

export type DocumentRoutingEvent =
  | { readonly type: 'closed'; readonly owner: DocumentOwner; readonly documentUri: string }
  | { readonly type: 'diagnosticsCleared'; readonly owner: DocumentOwner; readonly documentUri: string }
  | { readonly type: 'opened'; readonly owner: DocumentOwner; readonly documentUri: string }

export interface DocumentRoutingOptions {
  readonly getOwnership: () => DocumentOwnershipCoordinator
  readonly getBundled: () => BundledDocumentSynchronization
  readonly getLocal: () => LocalDocumentSynchronization
  readonly observer?: (event: DocumentRoutingEvent) => void
}

export function createPrepareDocumentRoutingCommit(options: DocumentRoutingOptions): PrepareDocumentOwnerCommit {
  return ({ document, previousOwner, nextOwner }) => {
    if (documentOwnersEqual(previousOwner, nextOwner)) return undefined

    return async () => {
      await closePreviousOwner(options, previousOwner, document)

      if (!documentOwnersEqual(options.getOwnership().classify(document), nextOwner)) return

      if (nextOwner.kind === 'bundled') {
        options.getBundled().openDocument(document)
        options.observer?.({ type: 'opened', owner: nextOwner, documentUri: document.uri.toString() })
      } else if (nextOwner.kind === 'local') {
        const local = options.getLocal()
        const client = await local.ensureClientForDocument(document)
        if (client && documentOwnersEqual(options.getOwnership().classify(document), nextOwner)) {
          await local.openDocument(nextOwner.workspaceFolderUri, document)
          options.observer?.({ type: 'opened', owner: nextOwner, documentUri: document.uri.toString() })
        }
      }
    }
  }
}

async function closePreviousOwner(
  options: DocumentRoutingOptions,
  previousOwner: DocumentOwner,
  document: TextDocument,
): Promise<void> {
  if (previousOwner.kind === 'bundled') {
    options.getBundled().closeDocument(document)
    options.observer?.({ type: 'closed', owner: previousOwner, documentUri: document.uri.toString() })
    options.getBundled().clearDiagnostics(document.uri)
    options.observer?.({ type: 'diagnosticsCleared', owner: previousOwner, documentUri: document.uri.toString() })
  } else if (previousOwner.kind === 'local') {
    const local = options.getLocal()
    await local.closeDocument(previousOwner.workspaceFolderUri, document)
    options.observer?.({ type: 'closed', owner: previousOwner, documentUri: document.uri.toString() })
    await local.clearDiagnostics(previousOwner.workspaceFolderUri, document.uri)
    options.observer?.({ type: 'diagnosticsCleared', owner: previousOwner, documentUri: document.uri.toString() })
  }
}

export function documentOwnersEqual(left: DocumentOwner, right: DocumentOwner): boolean {
  if (left.kind !== right.kind) return false
  return left.kind !== 'local' || (right.kind === 'local' && left.workspaceFolderUri === right.workspaceFolderUri)
}
