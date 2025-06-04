import { connect } from 'net'

export async function waitForPortBorrowed(port: number, retries = 0): Promise<void> {
  if (retries >= 10) return

  await new Promise((resolve) => setTimeout(resolve, retries * 100))

  await new Promise<void>((resolve, reject) => {
    const socket = connect(port, '127.0.0.1', resolve)
    socket.once('error', () => (socket.destroy(), reject()))
    socket.once('connect', () => (socket.destroy(), resolve()))
  }).catch(() => waitForPortBorrowed(port, retries + 1))
}
