import { setTimeout } from 'node:timers/promises'

export async function waitForProcessKilled(pid: number, attemptsMade = 0): Promise<void> {
  try {
    process.kill(pid, 0)
  } catch (error) {
    return
  }

  if (attemptsMade >= 10) {
    throw new Error(`Process ${pid} did not terminate after ${attemptsMade} attempts.`)
  }

  await setTimeout(100)
  await waitForProcessKilled(pid, attemptsMade + 1)
}
