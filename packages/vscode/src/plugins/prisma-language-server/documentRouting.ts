import type { TextDocument, Uri } from 'vscode'
import type {
  DocumentOwner,
  DocumentOwnerCommitOutcome,
  DocumentOwnershipCoordinator,
  PrepareDocumentOwnerCommit,
} from './documentOwnership'

export interface LegacyDocumentSynchronization {
  openDocument(document: TextDocument): void
  closeDocument(document: TextDocument): void
  clearDiagnostics(uri: Uri): void
}

export interface PrismaNextDocumentSynchronization {
  ensureClientForDocument(document: TextDocument): Promise<unknown>
  openDocument(workspaceFolderUri: string, document: TextDocument): Promise<boolean>
  closeDocument(workspaceFolderUri: string, document: TextDocument): Promise<void>
  clearDiagnostics(workspaceFolderUri: string, uri: Uri): Promise<void>
}

export interface DocumentRoutingOptions {
  readonly getOwnership: () => DocumentOwnershipCoordinator
  readonly isDocumentOpen: (document: TextDocument) => boolean
  readonly getLegacy: () => LegacyDocumentSynchronization
  readonly getPrismaNext: () => PrismaNextDocumentSynchronization
}

export function createPrepareDocumentRoutingCommit(options: DocumentRoutingOptions): PrepareDocumentOwnerCommit {
  return ({ document, previousSettledOwner, nextDesiredOwner }) => {
    if (documentOwnersEqual(previousSettledOwner, nextDesiredOwner)) return undefined

    return async () => {
      try {
        await closePreviousSettledOwner(options, previousSettledOwner, document)
      } catch (error) {
        return commitOutcome(previousSettledOwner, error)
      }

      try {
        await clearPreviousSettledOwnerDiagnostics(options, previousSettledOwner, document.uri)

        if (!isDesiredOpenCandidate(options, document, nextDesiredOwner)) {
          return commitOutcome({ kind: 'unowned' })
        }

        if (nextDesiredOwner.kind === 'legacy') {
          options.getLegacy().openDocument(document)
          return commitOutcome(nextDesiredOwner)
        }

        if (nextDesiredOwner.kind === 'prisma-next') {
          const prismaNext = options.getPrismaNext()
          const client = await prismaNext.ensureClientForDocument(document)
          if (
            client &&
            isDesiredOpenCandidate(options, document, nextDesiredOwner) &&
            (await prismaNext.openDocument(nextDesiredOwner.workspaceFolderUri, document))
          ) {
            return commitOutcome(nextDesiredOwner)
          }
        }

        return commitOutcome({ kind: 'unowned' })
      } catch (error) {
        return commitOutcome({ kind: 'unowned' }, error)
      }
    }
  }
}

async function closePreviousSettledOwner(
  options: DocumentRoutingOptions,
  previousSettledOwner: DocumentOwner,
  document: TextDocument,
): Promise<void> {
  if (previousSettledOwner.kind === 'legacy') {
    options.getLegacy().closeDocument(document)
  } else if (previousSettledOwner.kind === 'prisma-next') {
    await options.getPrismaNext().closeDocument(previousSettledOwner.workspaceFolderUri, document)
  }
}

async function clearPreviousSettledOwnerDiagnostics(
  options: DocumentRoutingOptions,
  previousSettledOwner: DocumentOwner,
  documentUri: Uri,
): Promise<void> {
  if (previousSettledOwner.kind === 'legacy') {
    options.getLegacy().clearDiagnostics(documentUri)
  } else if (previousSettledOwner.kind === 'prisma-next') {
    await options.getPrismaNext().clearDiagnostics(previousSettledOwner.workspaceFolderUri, documentUri)
  }
}

function commitOutcome(settledOwner: DocumentOwner, error?: unknown): DocumentOwnerCommitOutcome {
  return error === undefined ? { settledOwner } : { settledOwner, error }
}

function isDesiredOpenCandidate(
  options: DocumentRoutingOptions,
  document: TextDocument,
  candidate: DocumentOwner,
): boolean {
  return (
    options.isDocumentOpen(document) && documentOwnersEqual(options.getOwnership().getDesiredOwner(document), candidate)
  )
}

export function documentOwnersEqual(left: DocumentOwner, right: DocumentOwner): boolean {
  if (left.kind !== right.kind) return false
  return (
    left.kind !== 'prisma-next' ||
    (right.kind === 'prisma-next' && left.workspaceFolderUri === right.workspaceFolderUri)
  )
}
