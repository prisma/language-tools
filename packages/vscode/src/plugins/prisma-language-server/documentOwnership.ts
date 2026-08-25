import { isPrismaNextSchema } from '@prisma/language-server/prisma-next'
import type { TextDocument, Uri, WorkspaceFolder } from 'vscode'

export type DocumentOwner =
  | { readonly kind: 'legacy' }
  | { readonly kind: 'prisma-next'; readonly workspaceFolderUri: string }
  | { readonly kind: 'unowned' }

export interface DocumentOwnershipPolicy {
  isPinnedToPrisma6(): boolean
  isLegacyUnavailable?(): boolean
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

export interface DocumentOwnerCommitOutcome {
  readonly settledOwner: DocumentOwner
  readonly error?: unknown
}

export type PreparedDocumentOwnerCommit = () => Promise<DocumentOwnerCommitOutcome> | DocumentOwnerCommitOutcome

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
    if (this.options.policy.isPinnedToPrisma6() || !isPrismaNextSchema(document.getText())) {
      return this.options.policy.isLegacyUnavailable?.() ? unownedOwner : legacyOwner
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

    const commitTransition = await this.options.prepareTransition?.({
      document,
      previousSettledOwner: state.settledOwner,
      nextDesiredOwner: unownedOwner,
      revision,
    })
    if (revision !== state.revision) {
      return state.settledOwner
    }

    const outcome = commitTransition ? await commitTransition() : { settledOwner: unownedOwner }
    return this.recordCommitOutcome(state, outcome)
  }

  private async commitDesiredOwner(
    document: TextDocument,
    state: DocumentOwnershipState,
    revision: number,
  ): Promise<DocumentOwner> {
    while (revision === state.revision) {
      const nextDesiredOwner = this.getDesiredOwner(document)
      const commitTransition = await this.options.prepareTransition?.({
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

      const outcome = commitTransition ? await commitTransition() : { settledOwner: desiredOwner }
      return this.recordCommitOutcome(state, outcome)
    }

    return state.settledOwner
  }

  private recordCommitOutcome(state: DocumentOwnershipState, outcome: DocumentOwnerCommitOutcome): DocumentOwner {
    state.settledOwner = outcome.settledOwner
    if (outcome.error !== undefined) {
      throw outcome.error
    }
    return outcome.settledOwner
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
