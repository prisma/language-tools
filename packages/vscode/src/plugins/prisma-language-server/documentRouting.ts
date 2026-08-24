import type { TextDocument, Uri } from 'vscode'
import type { DocumentOwner, DocumentOwnershipCoordinator, PrepareDocumentOwnerCommit } from './documentOwnership'

export interface BundledDocumentSynchronization {
  openDocument(document: TextDocument): void
  closeDocument(document: TextDocument): void
  clearDiagnostics(uri: Uri): void
}

export interface LocalDocumentSynchronization {
  ensureClientForDocument(document: TextDocument): Promise<unknown>
  openDocument(workspaceFolderUri: string, document: TextDocument): Promise<boolean>
  closeDocument(workspaceFolderUri: string, document: TextDocument): Promise<void>
  clearDiagnostics(workspaceFolderUri: string, uri: Uri): Promise<void>
}

export type DocumentRoutingEvent =
  | { readonly type: 'closed'; readonly owner: DocumentOwner; readonly documentUri: string }
  | { readonly type: 'diagnosticsCleared'; readonly owner: DocumentOwner; readonly documentUri: string }
  | {
      readonly type: 'opened'
      readonly owner: DocumentOwner
      readonly documentUri: string
      readonly documentText: string
      readonly documentVersion: number
    }

export interface DocumentRoutingOptions {
  readonly getOwnership: () => DocumentOwnershipCoordinator
  readonly isDocumentOpen: (document: TextDocument) => boolean
  readonly getBundled: () => BundledDocumentSynchronization
  readonly getLocal: () => LocalDocumentSynchronization
  readonly observer?: (event: DocumentRoutingEvent) => void
}

export function createPrepareDocumentRoutingCommit(options: DocumentRoutingOptions): PrepareDocumentOwnerCommit {
  return ({ document, previousOwner, nextOwner }) => {
    if (documentOwnersEqual(previousOwner, nextOwner)) return undefined

    return async () => {
      await closePreviousOwner(options, previousOwner, document)

      if (!isCurrentOpenCandidate(options, document, nextOwner)) return

      if (nextOwner.kind === 'bundled') {
        options.getBundled().openDocument(document)
        observeOpened(options, nextOwner, document)
      } else if (nextOwner.kind === 'local') {
        const local = options.getLocal()
        const client = await local.ensureClientForDocument(document)
        if (client && isCurrentOpenCandidate(options, document, nextOwner)) {
          const opened = await local.openDocument(nextOwner.workspaceFolderUri, document)
          if (opened && isCurrentOpenCandidate(options, document, nextOwner)) {
            observeOpened(options, nextOwner, document)
          }
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

function observeOpened(options: DocumentRoutingOptions, owner: DocumentOwner, document: TextDocument): void {
  if (!options.observer) return
  options.observer({
    type: 'opened',
    owner,
    documentUri: document.uri.toString(),
    documentText: document.getText(),
    documentVersion: document.version,
  })
}

function isCurrentOpenCandidate(
  options: DocumentRoutingOptions,
  document: TextDocument,
  candidate: DocumentOwner,
): boolean {
  return options.isDocumentOpen(document) && documentOwnersEqual(options.getOwnership().classify(document), candidate)
}

export function documentOwnersEqual(left: DocumentOwner, right: DocumentOwner): boolean {
  if (left.kind !== right.kind) return false
  return left.kind !== 'local' || (right.kind === 'local' && left.workspaceFolderUri === right.workspaceFolderUri)
}
