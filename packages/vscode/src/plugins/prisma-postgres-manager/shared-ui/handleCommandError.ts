import { window } from 'vscode'

export class CommandAbortError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export const handleCommandError = async <T>(cmdTitle: string, cmd: () => Promise<T>): Promise<T | null> => {
  try {
    return await cmd()
  } catch (error) {
    if (error instanceof CommandAbortError) {
      void window.showInformationMessage(`${cmdTitle} aborted: ${error.message}`)
    } else if (error instanceof Error) {
      void window.showErrorMessage(`${cmdTitle} failed: ${error.message}`)
    } else {
      void window.showErrorMessage(`${cmdTitle} failed: An unknown error occurred`)
    }
    return null
  }
}
