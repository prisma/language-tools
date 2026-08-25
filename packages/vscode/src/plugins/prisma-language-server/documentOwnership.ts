import { isPrismaNextSchema } from '@prisma/language-server/prisma-next'
import type { TextDocument, Uri, WorkspaceFolder } from 'vscode'

export type DocumentOwner =
  | { readonly kind: 'legacy' }
  | { readonly kind: 'prisma-next'; readonly workspaceFolderUri: string }
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
  readonly previousSettledOwner: DocumentOwner
  readonly nextDesiredOwner: DocumentOwner
  readonly revision: number
}

export type PreparedDocumentOwnerCommit = () => Promise<DocumentOwner> | DocumentOwner

export type PrepareDocumentOwnerCommit = (
  transition: DocumentOwnershipTransition,
) => Promise<PreparedDocumentOwnerCommit | void> | PreparedDocumentOwnerCommit | void

export interface DocumentOwnershipCoordinatorOptions {
  readonly workspace: DocumentOwnershipWorkspace
  readonly policy: DocumentOwnershipPolicy
  readonly prepareTransition?: PrepareDocumentOwnerCommit
}

interface DocumentOwnershipState {
  revision: number
  settledOwner: DocumentOwner
  pending: Promise<void>
}

const legacyOwner: DocumentOwner = { kind: 'legacy' }
const unownedOwner: DocumentOwner = { kind: 'unowned' }

export class DocumentOwnershipCoordinator {
  private readonly states = new Map<string, DocumentOwnershipState>()

  constructor(private readonly options: DocumentOwnershipCoordinatorOptions) {}

  getDesiredOwner(document: TextDocument): DocumentOwner {
    if (this.options.policy.isPinnedToPrisma6()) {
      return legacyOwner
    }

    if (!isPrismaNextSchema(document.getText())) {
      return legacyOwner
    }

    if (document.uri.scheme !== 'file' || !this.options.workspace.isTrusted) {
      return unownedOwner
    }

    const workspaceFolder = this.options.workspace.getWorkspaceFolder(document.uri)
    if (!workspaceFolder) {
      return unownedOwner
    }

    return { kind: 'prisma-next', workspaceFolderUri: workspaceFolder.uri.toString() }
  }

  getSettledOwner(documentUri: Uri): DocumentOwner {
    return this.states.get(documentUri.toString())?.settledOwner ?? unownedOwner
  }

  synchronize(document: TextDocument): Promise<DocumentOwner> {
    return this.enqueue(document, (state, revision) => this.commitDesiredOwner(document, state, revision))
  }

  close(document: TextDocument): Promise<DocumentOwner> {
    return this.enqueue(document, (state, revision) => this.commitClosedOwner(document, state, revision))
  }

  private enqueue(
    document: TextDocument,
    commit: (state: DocumentOwnershipState, revision: number) => Promise<DocumentOwner>,
  ): Promise<DocumentOwner> {
    const state = this.getOrCreateState(document.uri.toString())
    const revision = ++state.revision
    const operation = state.pending.then(() => commit(state, revision))
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
      settledOwner: unownedOwner,
      pending: Promise.resolve(),
    }
    this.states.set(documentUri, state)
    return state
  }

  private async commitClosedOwner(
    document: TextDocument,
    state: DocumentOwnershipState,
    revision: number,
  ): Promise<DocumentOwner> {
    if (revision !== state.revision) {
      return state.settledOwner
    }

    const commitOwner = await this.options.prepareTransition?.({
      document,
      previousSettledOwner: state.settledOwner,
      nextDesiredOwner: unownedOwner,
      revision,
    })
    if (revision !== state.revision) {
      return state.settledOwner
    }

    const settledOwner = commitOwner ? await commitOwner() : unownedOwner
    state.settledOwner = settledOwner
    return settledOwner
  }

  private async commitDesiredOwner(
    document: TextDocument,
    state: DocumentOwnershipState,
    revision: number,
  ): Promise<DocumentOwner> {
    while (revision === state.revision) {
      const nextDesiredOwner = this.getDesiredOwner(document)
      const commitOwner = await this.options.prepareTransition?.({
        document,
        previousSettledOwner: state.settledOwner,
        nextDesiredOwner,
        revision,
      })

      if (revision !== state.revision) {
        return state.settledOwner
      }

      const desiredOwner = this.getDesiredOwner(document)
      if (!ownersEqual(desiredOwner, nextDesiredOwner)) {
        continue
      }

      const settledOwner = commitOwner ? await commitOwner() : desiredOwner
      state.settledOwner = settledOwner
      return settledOwner
    }

    return state.settledOwner
  }
}

function ownersEqual(left: DocumentOwner, right: DocumentOwner): boolean {
  if (left.kind !== right.kind) {
    return false
  }
  return (
    left.kind !== 'prisma-next' ||
    (right.kind === 'prisma-next' && left.workspaceFolderUri === right.workspaceFolderUri)
  )
}
