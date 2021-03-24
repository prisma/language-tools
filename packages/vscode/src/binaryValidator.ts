import { ExtensionContext, window } from 'vscode'

export const PRISMA_ALLOWED_BINS_KEY = 'prismaAllowedBins'

export type BinaryState = {
  allowed: boolean
}

export enum BinaryPopupStatus {
  Allow,
  Deny,
}

export type BinaryStorage = { libs: { [key: string]: BinaryState } }

export const checkAndAskForBinaryExecution = async (
  context: ExtensionContext,
  binaryPath: string | undefined,
  bins: BinaryStorage | undefined,
): Promise<boolean> => {
  // empty binary path means we are using the default binary
  if (!binaryPath || binaryPath === '') {
    return true
  }
  const existingBinaryState = bins?.libs[binaryPath]
  if (!existingBinaryState) {
    const item = await window.showInformationMessage(
      `Your VS Code workspace is defining a custom binary path for the Prisma extension: "${binaryPath}" Do you want to trust this binary and let the extension execute it?`,
      {
        modal: true,
      },
      { title: 'Allow', value: BinaryPopupStatus.Allow },
      { title: 'Deny', value: BinaryPopupStatus.Deny },
    )
    if (item === undefined) {
      // dialog was cancelled
      return false
    }

    let result = false

    if (item.value === BinaryPopupStatus.Allow) {
      result = true
    }

    if (item.value === BinaryPopupStatus.Deny) {
      result = false
    }

    // store the state
    bins = bins ? bins : { libs: {} }
    bins.libs[binaryPath] = { allowed: result }
    await context.globalState.update(PRISMA_ALLOWED_BINS_KEY, bins)
    return result
  } else {
    return existingBinaryState.allowed
  }
}

export const printBinaryCheckWarning = async () => {
  await window.showWarningMessage(
    "Prisma extension hasn't got the approval for usage for binary defined in settings. Please either change the binary path or reset library execution decisions.",
  )
}
