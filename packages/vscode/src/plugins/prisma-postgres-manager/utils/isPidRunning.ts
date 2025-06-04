export function isPidRunning(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch {}

  return false
}
