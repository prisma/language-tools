import { setTimeout } from 'node:timers/promises'
import type { Server } from '@prisma/dev'

let server: Server | undefined

async function main() {
  const [, , name] = process.argv

  console.log(
    JSON.stringify({
      message: `[PPG Dev] Starting process (${process.pid}) for database: ${name}`,
    }),
  )

  if (!name) {
    console.log(
      JSON.stringify({
        message: '[PPG Dev] Missing argument, server cannot be started',
      }),
    )
    process.exit(1)
  }

  try {
    const { unstable_startServer } = await import('@prisma/dev')

    server = await unstable_startServer({ debug: true, persistenceMode: 'stateful', name })

    process.send?.({ type: 'started' })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    process.send?.({ type: 'error', error: errorMessage })
    await setTimeout(1000)
    process.exit(1)
  }
}

// Handle process termination gracefully
process.on('SIGTERM', () => {
  void (async () => {
    console.log(
      JSON.stringify({
        message: '[PPG Dev] Received SIGTERM, shutting down gracefully...',
      }),
    )
    await server?.close()
    process.exit(0)
  })()
})

process.on('SIGINT', () => {
  void (async () => {
    console.log(
      JSON.stringify({
        message: '[PPG Dev] Received SIGINT, shutting down gracefully...',
      }),
    )
    await server?.close()
    process.exit(0)
  })()
})

void main()
