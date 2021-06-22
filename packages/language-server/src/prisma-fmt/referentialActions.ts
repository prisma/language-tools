import execa from 'execa'

export default function referentialActions(
  execPath: string,
  text: string,
  onError?: (errorMessage: string) => void,
): string[] {
  const result = execa.sync(execPath, ['referential-actions'], { input: text })

  if (result.exitCode !== 0) {
    const errorMessage =
      "prisma-fmt error'd during getting available referential actions.\n"

    if (onError) {
      onError(errorMessage + result.stderr)
    }

    console.error(errorMessage)
    console.error(result.stderr)
    return []
  }
  return JSON.parse(result.stdout) as string[]
}
