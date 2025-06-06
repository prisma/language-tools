import { connect } from 'net'
import { setTimeout } from 'node:timers/promises'

export async function waitForPortAvailable(port: number, attemptsMade = 0): Promise<void> {
  if (attemptsMade >= 10) {
    throw new Error(`Port ${port} was not released`)
  }

  await setTimeout(attemptsMade * 100)

  await new Promise<void>((resolve, reject) => {
    const socket = connect(port, '127.0.0.1')
    socket.once('error', () => (socket.destroy(), resolve()))
    socket.once('connect', () => (socket.destroy(), reject()))
  }).catch(() => waitForPortAvailable(port, attemptsMade + 1))
}
