import type { Server } from '@prisma/dev'

let server: Server | undefined

async function main() {
  const name = process.argv[2]

  console.log(`[PPG Dev] Starting process (${process.pid}) for database: ${name}`)

  if (!name) {
    console.log('[PPG Dev] Missing argument, server cannot be started')
    process.exit(1)
  }

  try {
    const { unstable_startServer } = await import('@prisma/dev')

    server = await unstable_startServer({ persistenceMode: 'stateful', name })

    // this message is important and required to know on the spawning side if alive
    console.log(`[PPG Dev] Server started successfully for database: ${name}`)
  } catch (error) {
    // this message is important and required to know on the spawning side if dead
    console.error(`[PPG Dev] Error starting server for database ${name}:`, error)
    await new Promise((r) => setTimeout(r, 1000))
    process.exit(1)
  }
}

// Handle process termination gracefully
process.on('SIGTERM', () => {
  void (async () => {
    console.log('[PPG Dev] Received SIGTERM, shutting down gracefully...')
    await server?.close()
    process.exit(0)
  })()
})

process.on('SIGINT', () => {
  void (async () => {
    console.log('[PPG Dev] Received SIGINT, shutting down gracefully...')
    await server?.close()
    process.exit(0)
  })()
})

void main()
