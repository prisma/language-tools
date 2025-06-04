async function main() {
  const name = process.argv[2]
  const port = +process.argv[3]
  const databasePort = +process.argv[4]
  const shadowDatabasePort = +process.argv[5]

  console.log(`[PPG Dev] Starting process (${process.pid}) for database: ${name}`)

  if (!name || !port || !databasePort || !shadowDatabasePort) {
    console.log('[PPG Dev] Missing argument, server cannot be started')
    process.exit(1)
  }

  try {
    console.log('[PPG Dev] Starting server...')

    const { unstable_startServer } = await import('@prisma/dev')

    await unstable_startServer({ persistenceMode: 'stateful', name, port, databasePort, shadowDatabasePort })

    console.log(`[PPG Dev] Server started successfully for database: ${name}`)
  } catch (error) {
    console.error(`[PPG Dev] Error starting server for database ${name}:`, error)
    process.exit(1)
  }
}

// Handle process termination gracefully
process.on('SIGTERM', () => {
  console.log('[PPG Dev] Received SIGTERM, shutting down gracefully...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('[PPG Dev] Received SIGINT, shutting down gracefully...')
  process.exit(0)
})

void main()
