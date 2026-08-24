import { describe, expect, test, vi } from 'vitest'
import type { TextDocument, Uri, WorkspaceFolder } from 'vscode'
import {
  DocumentOwnershipCoordinator,
  type DocumentOwner,
  type DocumentOwnershipCoordinatorOptions,
  type DocumentOwnershipTestEvent,
} from './documentOwnership'

const rootA = workspaceFolder('file:///workspace-a')
const rootB = workspaceFolder('file:///workspace-b')

function uri(value: string): Uri {
  const scheme = value.slice(0, value.indexOf(':'))
  return { scheme, toString: () => value } as Uri
}

function workspaceFolder(value: string): WorkspaceFolder {
  return { uri: uri(value) } as WorkspaceFolder
}

function document(value: string, text: string): TextDocument & { setText(nextText: string): void } {
  let currentText = text
  return {
    uri: uri(value),
    languageId: 'prisma',
    getText: () => currentText,
    setText: (nextText: string) => {
      currentText = nextText
    },
  } as TextDocument & { setText(nextText: string): void }
}

function coordinator(overrides: Partial<DocumentOwnershipCoordinatorOptions> = {}): DocumentOwnershipCoordinator {
  return new DocumentOwnershipCoordinator({
    workspace: {
      isTrusted: true,
      getWorkspaceFolder: (documentUri) =>
        documentUri.toString().includes('workspace-a')
          ? rootA
          : documentUri.toString().includes('workspace-b')
            ? rootB
            : undefined,
    },
    policy: { isPinnedToPrisma6: () => false },
    ...overrides,
  })
}

function deferred(): { promise: Promise<void>; resolve(): void } {
  let resolvePromise: (() => void) | undefined
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve
  })
  return {
    promise,
    resolve: () => resolvePromise?.(),
  }
}

describe('DocumentOwnershipCoordinator', () => {
  test.each([
    '// use prisma-next\nmodel User { id Int @id }',
    '\n\t//use prisma-next\nmodel User { id Int @id }',
    '//   use   prisma-next   \nmodel User { id Int @id }',
  ])('preserves canonical Prisma Next directive matching for %j', (text) => {
    const subject = coordinator()

    expect(subject.classify(document('file:///workspace-a/schema.prisma', text))).toEqual({
      kind: 'local',
      workspaceFolderUri: rootA.uri.toString(),
    })
  })

  test('keeps unsupported directive spellings with the bundled owner', () => {
    const subject = coordinator()

    expect(subject.classify(document('file:///workspace-a/schema.prisma', '// use prisma next'))).toEqual({
      kind: 'bundled',
    })
  })

  test('classifies marked files independently by matching workspace folder', async () => {
    const subject = coordinator()
    const first = document('file:///workspace-a/first.prisma', '// use prisma-next')
    const second = document('file:///workspace-b/second.prisma', 'model User { id Int @id }')

    await Promise.all([subject.synchronize(first), subject.synchronize(second)])

    expect(subject.getOwner(first.uri)).toEqual({ kind: 'local', workspaceFolderUri: rootA.uri.toString() })
    expect(subject.getOwner(second.uri)).toEqual({ kind: 'bundled' })
  })

  test.each([
    { name: 'untrusted workspace', value: 'file:///workspace-a/schema.prisma', trusted: false },
    { name: 'non-file document', value: 'untitled:Untitled-1', trusted: true },
    { name: 'unmatched workspace', value: 'file:///outside/schema.prisma', trusted: true },
  ])('leaves a marked document unowned in an $name', ({ value, trusted }) => {
    const subject = coordinator({
      workspace: {
        isTrusted: trusted,
        getWorkspaceFolder: (documentUri) => (documentUri.toString().includes('workspace-a') ? rootA : undefined),
      },
    })

    expect(subject.classify(document(value, '// use prisma-next'))).toEqual({ kind: 'unowned' })
  })

  test('lets pin policy force bundled ownership', () => {
    const subject = coordinator({ policy: { isPinnedToPrisma6: () => true } })

    expect(subject.classify(document('file:///workspace-a/schema.prisma', '// use prisma-next'))).toEqual({
      kind: 'bundled',
    })
  })

  test('serializes transitions for each document URI', async () => {
    let activeTransitions = 0
    let maximumActiveTransitions = 0
    const firstGate = deferred()
    const secondGate = deferred()
    const gates = [firstGate, secondGate]
    const subject = coordinator({
      prepareOwner: async () => {
        const gate = gates.shift()
        activeTransitions += 1
        maximumActiveTransitions = Math.max(maximumActiveTransitions, activeTransitions)
        await gate?.promise
        activeTransitions -= 1
      },
    })
    const schema = document('file:///workspace-a/schema.prisma', '// use prisma-next')

    const first = subject.synchronize(schema)
    await vi.waitFor(() => expect(activeTransitions).toBe(1))
    schema.setText('model User { id Int @id }')
    const second = subject.synchronize(schema)

    firstGate.resolve()
    await vi.waitFor(() => expect(activeTransitions).toBe(1))
    secondGate.resolve()
    await Promise.all([first, second])

    expect(maximumActiveTransitions).toBe(1)
    expect(subject.getOwner(schema.uri)).toEqual({ kind: 'bundled' })
  })

  test('reclassifies current text after asynchronous work', async () => {
    const gate = deferred()
    let calls = 0
    const subject = coordinator({
      prepareOwner: async () => {
        calls += 1
        if (calls === 1) {
          await gate.promise
        }
      },
    })
    const schema = document('file:///workspace-a/schema.prisma', '// use prisma-next')

    const transition = subject.synchronize(schema)
    await vi.waitFor(() => expect(calls).toBe(1))
    schema.setText('model User { id Int @id }')
    gate.resolve()

    await expect(transition).resolves.toEqual({ kind: 'bundled' })
    expect(calls).toBe(2)
    expect(subject.getOwner(schema.uri)).toEqual({ kind: 'bundled' })
  })

  test('reclassifies pin policy after asynchronous work', async () => {
    const gate = deferred()
    let pinnedToPrisma6 = false
    let calls = 0
    const subject = coordinator({
      policy: { isPinnedToPrisma6: () => pinnedToPrisma6 },
      prepareOwner: async () => {
        calls += 1
        if (calls === 1) {
          await gate.promise
        }
      },
    })
    const schema = document('file:///workspace-a/schema.prisma', '// use prisma-next')

    const transition = subject.synchronize(schema)
    await vi.waitFor(() => expect(calls).toBe(1))
    pinnedToPrisma6 = true
    gate.resolve()

    await expect(transition).resolves.toEqual({ kind: 'bundled' })
    expect(calls).toBe(2)
    expect(subject.getOwner(schema.uri)).toEqual({ kind: 'bundled' })
  })

  test('guards ownership side effects from superseded transitions', async () => {
    const firstPreparation = deferred()
    const committedOwners: DocumentOwner[] = []
    let activeCommits = 0
    let maximumActiveCommits = 0
    const subject = coordinator({
      prepareOwner: async (transition) => {
        if (transition.revision === 1) {
          await firstPreparation.promise
        }
        return async () => {
          activeCommits += 1
          maximumActiveCommits = Math.max(maximumActiveCommits, activeCommits)
          committedOwners.push(transition.nextOwner)
          await Promise.resolve()
          activeCommits -= 1
        }
      },
    })
    const schema = document('file:///workspace-a/schema.prisma', '// use prisma-next')

    const supersededTransition = subject.synchronize(schema)
    await Promise.resolve()
    schema.setText('model User { id Int @id }')
    const survivingTransition = subject.synchronize(schema)
    firstPreparation.resolve()

    await Promise.all([supersededTransition, survivingTransition])

    expect(committedOwners).toEqual([{ kind: 'bundled' }])
    expect(maximumActiveCommits).toBe(1)
    expect(subject.getOwner(schema.uri)).toEqual({ kind: 'bundled' })
  })

  test('records a completed commit before the queued successor transitions', async () => {
    const firstCommitStarted = deferred()
    const releaseFirstCommit = deferred()
    const previousOwners: DocumentOwner[] = []
    let externalOwner: DocumentOwner = { kind: 'unowned' }
    let activeCommits = 0
    let maximumActiveCommits = 0
    const subject = coordinator({
      prepareOwner: (transition) => async () => {
        activeCommits += 1
        maximumActiveCommits = Math.max(maximumActiveCommits, activeCommits)
        previousOwners.push(transition.previousOwner)
        if (transition.revision === 1) {
          firstCommitStarted.resolve()
          await releaseFirstCommit.promise
        }
        externalOwner = transition.nextOwner
        activeCommits -= 1
      },
    })
    const schema = document('file:///workspace-a/schema.prisma', '// use prisma-next')

    const firstTransition = subject.synchronize(schema)
    await firstCommitStarted.promise
    schema.setText('model User { id Int @id }')
    const survivingTransition = subject.synchronize(schema)
    releaseFirstCommit.resolve()

    await Promise.all([firstTransition, survivingTransition])

    expect(previousOwners).toEqual([{ kind: 'unowned' }, { kind: 'local', workspaceFolderUri: rootA.uri.toString() }])
    expect(externalOwner).toEqual({ kind: 'bundled' })
    expect(subject.getOwner(schema.uri)).toEqual(externalOwner)
    expect(maximumActiveCommits).toBe(1)
  })

  test('discards stale asynchronous work after a newer transition', async () => {
    const gate = deferred()
    const events: DocumentOwnershipTestEvent[] = []
    let calls = 0
    const subject = coordinator({
      prepareOwner: async () => {
        calls += 1
        if (calls === 1) {
          await gate.promise
        }
      },
      testObserver: (event) => events.push(event),
    })
    const schema = document('file:///workspace-a/schema.prisma', '// use prisma-next')

    const staleTransition = subject.synchronize(schema)
    await vi.waitFor(() => expect(calls).toBe(1))
    schema.setText('model User { id Int @id }')
    const currentTransition = subject.synchronize(schema)
    gate.resolve()

    await Promise.all([staleTransition, currentTransition])

    expect(subject.getOwner(schema.uri)).toEqual({ kind: 'bundled' })
    expect(events).toContainEqual({
      type: 'staleTransitionDiscarded',
      documentUri: schema.uri.toString(),
      revision: 1,
      owner: { kind: 'unowned' } satisfies DocumentOwner,
    })
    expect(events.at(-1)).toEqual({
      type: 'ownerChanged',
      documentUri: schema.uri.toString(),
      revision: 2,
      previousOwner: { kind: 'unowned' },
      owner: { kind: 'bundled' },
    })
  })
})
