import { connect } from 'net'
import { setTimeout } from 'node:timers/promises'

export async function waitForPortBorrowed(port: number, attemptsMade = 0): Promise<void> {
  if (attemptsMade >= 10) {
    throw new Error(`Port ${port} was not borrowed`)
  }

  await setTimeout(attemptsMade * 100)

  await new Promise<void>((resolve, reject) => {
    const socket = connect(port, '127.0.0.1', resolve)
    socket.once('error', () => (socket.destroy(), reject()))
    socket.once('connect', () => (socket.destroy(), resolve()))
  }).catch(() => waitForPortBorrowed(port, attemptsMade + 1))
}
