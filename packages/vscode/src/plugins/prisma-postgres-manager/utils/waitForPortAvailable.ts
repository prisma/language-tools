import { connect } from 'net'

export async function waitForPortAvailable(port: number, retries = 0): Promise<void> {
  if (retries >= 10) return

  await new Promise((resolve) => setTimeout(resolve, retries * 100))

  await new Promise<void>((resolve, reject) => {
    const socket = connect(port, '127.0.0.1')
    socket.once('error', () => (socket.destroy(), resolve()))
    socket.once('connect', () => (socket.destroy(), reject()))
  }).catch(() => waitForPortAvailable(port, retries + 1))
}
