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

export interface DocumentRoutingOptions {
  readonly getOwnership: () => DocumentOwnershipCoordinator
  readonly isDocumentOpen: (document: TextDocument) => boolean
  readonly getBundled: () => BundledDocumentSynchronization
  readonly getLocal: () => LocalDocumentSynchronization
}

export function createPrepareDocumentRoutingCommit(options: DocumentRoutingOptions): PrepareDocumentOwnerCommit {
  return ({ document, previousOwner, nextOwner }) => {
    if (documentOwnersEqual(previousOwner, nextOwner)) return undefined

    return async () => {
      await closePreviousOwner(options, previousOwner, document)

      if (!isCurrentOpenCandidate(options, document, nextOwner)) return

      if (nextOwner.kind === 'bundled') {
        options.getBundled().openDocument(document)
      } else if (nextOwner.kind === 'local') {
        const local = options.getLocal()
        const client = await local.ensureClientForDocument(document)
        if (client && isCurrentOpenCandidate(options, document, nextOwner)) {
          await local.openDocument(nextOwner.workspaceFolderUri, document)
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
    options.getBundled().clearDiagnostics(document.uri)
  } else if (previousOwner.kind === 'local') {
    const local = options.getLocal()
    await local.closeDocument(previousOwner.workspaceFolderUri, document)
    await local.clearDiagnostics(previousOwner.workspaceFolderUri, document.uri)
  }
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
