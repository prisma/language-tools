import chokidar from 'chokidar'
import envPaths from 'env-paths'
import { fork } from 'node:child_process'
import { EventEmitter, ExtensionContext, Uri } from 'vscode'
import { z } from 'zod'

/**
 * FIXME: SHOULD BE EXPOSED BY `@prisma/dev/internal/state` IN THE FUTURE
 */
const STATE_FOLDER_PATH = envPaths('prisma-dev').data

export const DevInstanceSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().url(),
  pid: z.number().nullish(),
  running: z.boolean(),
  ports: z.array(z.number().int().min(1).max(65535)).length(3),
})

export type DevInstance = z.infer<typeof DevInstanceSchema>

export class PrismaDevRepository {
  private cache = new CacheManager()
  public readonly refreshEventEmitter = new EventEmitter<void | DevInstance>()

  constructor(private readonly context: ExtensionContext) {
    const watcher = chokidar.watch(STATE_FOLDER_PATH, { ignoreInitial: true, usePolling: true })

    watcher.on('addDir', () => this.refreshEventEmitter.fire())
    watcher.on('unlinkDir', () => this.refreshEventEmitter.fire())
    watcher.on('change', () => this.refreshEventEmitter.fire())

    context.subscriptions.push({ dispose: () => watcher.close() })
  }

  async startInstance(args: { name: string }): Promise<void> {
    try {
      const { name } = args

      const database = await this.getInstance({ name })

      if (database?.running) {
        return
      }

      const { fsPath } = Uri.joinPath(this.context.extensionUri, ...['dist', 'workers', 'ppgDevServer.js'])

      let succeededStarting: () => void, failedStarting: (reason?: unknown) => void
      const startedPromise = new Promise<void>((resolve, reject) => {
        succeededStarting = resolve
        failedStarting = reject
      })

      const child = fork(fsPath, [name], { detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] })

      child.once('error', (error) => failedStarting(error))
      child.once('message', (message: unknown) => {
        if (typeof message !== 'object' || message == null) {
          return
        }

        if ('type' in message && message.type === 'started') {
          return succeededStarting()
        }

        if ('error' in message) {
          const errorMsg = typeof message.error === 'string' ? message.error : 'Unknown error'
          failedStarting(new Error(errorMsg))
        }
      })

      try {
        await startedPromise
      } finally {
        child.disconnect()
        child.unref()
        child.removeAllListeners()
      }
    } finally {
      this.refreshEventEmitter.fire()
    }
  }

  async deleteInstance(args: { name: string }): Promise<void> {
    try {
      const { name } = args

      const database = await this.getInstance({ name })

      if (!database) {
        return
      }

      const { deleteServer } = await import('@prisma/dev/internal/state')

      await deleteServer(name, true)
    } finally {
      this.refreshEventEmitter.fire()
    }
  }

  async deployInstance(args: { name: string; url: string }): Promise<void> {
    try {
      const { name, url } = args

      await this.stopInstance({ name })

      const { ServerState } = await import('@prisma/dev/internal/state')

      const state = await ServerState.createExclusively({ name, persistenceMode: 'stateful' })

      try {
        const { dumpDB } = await import('@prisma/dev/internal/db')

        const dump = await dumpDB({ dataDir: state.pgliteDataDirPath })

        const { Client } = await import('@prisma/ppg')

        await new Client({ connectionString: url }).query(dump, [])
      } finally {
        await state.close()
      }
    } finally {
      this.refreshEventEmitter.fire()
    }
  }

  async getInstance(args: { name: string }): Promise<DevInstance | undefined> {
    const { name } = args

    const instances = await this.getInstances()

    return instances.find((instance) => instance.name === name)
  }

  async getInstanceConnectionString(args: { name: string }): Promise<string> {
    const { name } = args

    const instance = await this.getInstance({ name })

    if (!instance?.running) {
      this.refreshEventEmitter.fire()

      throw new Error('This database has been deleted or stopped')
    }

    return instance.url
  }

  async getInstances(): Promise<DevInstance[]> {
    const cached = this.cache.getInstances()

    if (cached) {
      return cached
    }

    const { isServerRunning, ServerState } = await import('@prisma/dev/internal/state')

    const states = await ServerState.scan()

    const instances = states.map((state) => ({
      id: state.name,
      name: state.name,
      pid: state.pid != null && state.pid !== process.pid ? state.pid : undefined,
      ports: [state.port, state.databasePort, state.shadowDatabasePort],
      running: state.pid !== process.pid && isServerRunning(state),
      url: state.exports?.database.connectionString || 'http://offline',
    }))

    this.cache.setInstances(instances)

    return instances
  }

  async stopInstance(args: { name: string }): Promise<void> {
    try {
      const { name } = args

      const instance = await this.getInstance({ name })

      if (!instance?.running) {
        return
      }

      const { killServer } = await import('@prisma/dev/internal/state')

      await killServer(name, true)
    } finally {
      this.refreshEventEmitter.fire()
    }
  }
}

class CacheManager {
  private instances: { timestamp: number; data: DevInstance[] } | undefined

  clear() {
    this.instances = undefined
  }

  getInstances(): DevInstance[] | undefined {
    if (!this.instances || Date.now() - this.instances.timestamp >= 100) {
      return
    }

    return this.instances.data
  }

  setInstances(instances: DevInstance[]): void {
    this.instances = { timestamp: Date.now(), data: instances }
  }
}
