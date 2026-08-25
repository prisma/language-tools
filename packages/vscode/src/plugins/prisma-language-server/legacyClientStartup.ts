export type LegacyClientStartupStatus = 'idle' | 'starting' | 'ready' | 'failed' | 'disposed'

export interface LegacyClientStartupOptions<T> {
  readonly isCurrent: (value: T) => boolean
  readonly synchronize: (value: T) => Promise<unknown>
  readonly logError: (error: unknown) => void
}

export async function deactivateLegacyClient<T>(
  startup: LegacyClientStartup<T> | undefined,
  stop: (() => Promise<unknown>) | undefined,
  logError: (error: unknown) => void,
): Promise<void> {
  startup?.dispose()
  if (!stop) return

  try {
    await stop()
  } catch (error) {
    reportError(logError, error)
  }
}

export class LegacyClientStartup<T> {
  private generation = 0
  private readiness: Promise<boolean> = Promise.resolve(false)
  private readonly pending = new Map<T, number>()
  private currentStatus: LegacyClientStartupStatus = 'idle'

  constructor(private readonly options: LegacyClientStartupOptions<T>) {}

  get status(): LegacyClientStartupStatus {
    return this.currentStatus
  }

  start(startClient: () => Promise<void>): void {
    if (this.currentStatus !== 'idle') return
    this.install(startClient())
  }

  replace(readiness: Promise<void>): void {
    if (this.currentStatus === 'disposed') return
    this.install(readiness)
  }

  schedule(value: T): void {
    if (this.currentStatus === 'idle' || this.currentStatus === 'failed' || this.currentStatus === 'disposed') return
    if (this.pending.has(value)) return

    const generation = this.generation
    this.pending.set(value, generation)
    void this.readiness
      .then(async (ready) => {
        if (!ready || generation !== this.generation || !this.options.isCurrent(value)) return
        await this.options.synchronize(value)
      })
      .catch((error: unknown) => this.report(error))
      .finally(() => {
        if (this.pending.get(value) === generation) {
          this.pending.delete(value)
        }
      })
      .catch((error: unknown) => this.report(error))
  }

  dispose(): void {
    this.generation += 1
    this.currentStatus = 'disposed'
    this.pending.clear()
  }

  private install(readiness: Promise<void>): void {
    const generation = ++this.generation
    this.currentStatus = 'starting'
    this.pending.clear()
    this.readiness = readiness.then(
      () => {
        if (generation !== this.generation) return false
        this.currentStatus = 'ready'
        return true
      },
      (error: unknown) => {
        if (generation !== this.generation) return false
        this.currentStatus = 'failed'
        this.report(error)
        return false
      },
    )
  }

  private report(error: unknown): void {
    reportError(this.options.logError, error)
  }
}

function reportError(logError: (error: unknown) => void, error: unknown): void {
  try {
    logError(error)
  } catch {
    // Logging must never turn handled lifecycle failures back into detached rejections.
  }
}
