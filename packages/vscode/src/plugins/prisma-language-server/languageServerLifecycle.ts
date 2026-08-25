import type { LanguageClient } from 'vscode-languageclient/node'

export class LanguageServerLifecycleController {
  private disposed = false
  private queue: Promise<void> = Promise.resolve()
  private latestLegacyClient: LanguageClient | undefined
  private deactivation: Promise<void> | undefined
  private signalDisposal!: () => void
  private readonly disposalSignal = new Promise<void>((resolve) => {
    this.signalDisposal = resolve
  })

  get isActive(): boolean {
    return !this.disposed
  }

  assertActive(): void {
    if (this.disposed) {
      throw new Error('Prisma language-server lifecycle has been disposed.')
    }
  }

  publishLegacyClient(client: LanguageClient): void {
    this.assertActive()
    this.latestLegacyClient = client
  }

  waitFor<T>(operation: Promise<T>): Promise<T> {
    return Promise.race([
      operation,
      this.disposalSignal.then(() => {
        throw new Error('Prisma language-server lifecycle has been disposed.')
      }),
    ])
  }

  enqueue<T>(operation: () => Promise<T>): Promise<T> {
    if (this.disposed) {
      return Promise.reject(new Error('Prisma language-server lifecycle has been disposed.'))
    }

    const queued = this.queue.then(
      () => {
        this.assertActive()
        return operation()
      },
      () => {
        this.assertActive()
        return operation()
      },
    )
    this.queue = queued.then(
      () => undefined,
      () => undefined,
    )
    return queued
  }

  dispose(): Promise<void> {
    if (this.deactivation) return this.deactivation

    this.disposed = true
    this.signalDisposal()
    this.deactivation = this.queue.then(async () => {
      const client = this.latestLegacyClient
      if (client) await client.stop()
    })
    return this.deactivation
  }
}
