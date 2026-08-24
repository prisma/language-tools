import { isPrismaNextSchema } from '@prisma/language-server/prisma-next'
import type { TextDocument, Uri, WorkspaceFolder } from 'vscode'

export type DocumentOwner =
  | { readonly kind: 'bundled' }
  | { readonly kind: 'local'; readonly workspaceFolderUri: string }
  | { readonly kind: 'unowned' }

export interface DocumentOwnershipPolicy {
  isPinnedToPrisma6(): boolean
}

export interface DocumentOwnershipWorkspace {
  readonly isTrusted: boolean
  getWorkspaceFolder(uri: Uri): WorkspaceFolder | undefined
}

export interface DocumentOwnershipTransition {
  readonly document: TextDocument
  readonly previousOwner: DocumentOwner
  readonly nextOwner: DocumentOwner
  readonly revision: number
}

export type PreparedDocumentOwnerCommit = () => Promise<void> | void

export type PrepareDocumentOwnerCommit = (
  transition: DocumentOwnershipTransition,
) => Promise<PreparedDocumentOwnerCommit | void> | PreparedDocumentOwnerCommit | void

export type DocumentOwnershipTestEvent =
  | {
      readonly type: 'ownerChanged'
      readonly documentUri: string
      readonly revision: number
      readonly previousOwner: DocumentOwner
      readonly owner: DocumentOwner
    }
  | {
      readonly type: 'staleTransitionDiscarded'
      readonly documentUri: string
      readonly revision: number
      readonly owner: DocumentOwner
    }

export interface DocumentOwnershipCoordinatorOptions {
  readonly workspace: DocumentOwnershipWorkspace
  readonly policy: DocumentOwnershipPolicy
  readonly prepareOwner?: PrepareDocumentOwnerCommit
  readonly testObserver?: (event: DocumentOwnershipTestEvent) => void
}

interface DocumentOwnershipState {
  revision: number
  owner: DocumentOwner
  pending: Promise<void>
}

const bundledOwner: DocumentOwner = { kind: 'bundled' }
const unownedOwner: DocumentOwner = { kind: 'unowned' }

export class DocumentOwnershipCoordinator {
  private readonly states = new Map<string, DocumentOwnershipState>()

  constructor(private readonly options: DocumentOwnershipCoordinatorOptions) {}

  classify(document: TextDocument): DocumentOwner {
    if (this.options.policy.isPinnedToPrisma6()) {
      return bundledOwner
    }

    if (!isPrismaNextSchema(document.getText())) {
      return bundledOwner
    }

    if (document.uri.scheme !== 'file' || !this.options.workspace.isTrusted) {
      return unownedOwner
    }

    const workspaceFolder = this.options.workspace.getWorkspaceFolder(document.uri)
    if (!workspaceFolder) {
      return unownedOwner
    }

    return { kind: 'local', workspaceFolderUri: workspaceFolder.uri.toString() }
  }

  getOwner(documentUri: Uri): DocumentOwner {
    return this.states.get(documentUri.toString())?.owner ?? unownedOwner
  }

  synchronize(document: TextDocument): Promise<DocumentOwner> {
    const documentUri = document.uri.toString()
    const state = this.getOrCreateState(documentUri)
    const revision = ++state.revision

    const operation = state.pending.then(() => this.commitCurrentOwner(document, state, revision))
    state.pending = operation.then(
      () => undefined,
      () => undefined,
    )

    return operation
  }

  private getOrCreateState(documentUri: string): DocumentOwnershipState {
    const existing = this.states.get(documentUri)
    if (existing) {
      return existing
    }

    const state: DocumentOwnershipState = {
      revision: 0,
      owner: unownedOwner,
      pending: Promise.resolve(),
    }
    this.states.set(documentUri, state)
    return state
  }

  private async commitCurrentOwner(
    document: TextDocument,
    state: DocumentOwnershipState,
    revision: number,
  ): Promise<DocumentOwner> {
    const documentUri = document.uri.toString()

    while (revision === state.revision) {
      const nextOwner = this.classify(document)
      const commitOwner = await this.options.prepareOwner?.({
        document,
        previousOwner: state.owner,
        nextOwner,
        revision,
      })

      if (revision !== state.revision) {
        this.options.testObserver?.({
          type: 'staleTransitionDiscarded',
          documentUri,
          revision,
          owner: state.owner,
        })
        return state.owner
      }

      const currentOwner = this.classify(document)
      if (!ownersEqual(currentOwner, nextOwner)) {
        continue
      }

      await commitOwner?.()

      if (revision !== state.revision) {
        this.options.testObserver?.({
          type: 'staleTransitionDiscarded',
          documentUri,
          revision,
          owner: state.owner,
        })
        return state.owner
      }

      const previousOwner = state.owner
      state.owner = currentOwner
      if (!ownersEqual(previousOwner, currentOwner)) {
        this.options.testObserver?.({
          type: 'ownerChanged',
          documentUri,
          revision,
          previousOwner,
          owner: currentOwner,
        })
      }
      return currentOwner
    }

    this.options.testObserver?.({
      type: 'staleTransitionDiscarded',
      documentUri,
      revision,
      owner: state.owner,
    })
    return state.owner
  }
}

function ownersEqual(left: DocumentOwner, right: DocumentOwner): boolean {
  if (left.kind !== right.kind) {
    return false
  }
  return left.kind !== 'local' || (right.kind === 'local' && left.workspaceFolderUri === right.workspaceFolderUri)
}
