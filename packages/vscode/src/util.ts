import { window, env, workspace, ExtensionContext } from 'vscode'
import { LanguageClientOptions } from 'vscode-languageclient'
import { LanguageClient, ServerOptions } from 'vscode-languageclient/node'
import { isPrismaNextSchema } from '@prisma/language-server/prisma-next'
import { denyListDarkColorThemes, denyListLightColorThemes } from './denyListColorThemes'
import { homedir } from 'os'
import { readdirSync } from 'fs'
import path from 'path'
export function isDebugOrTestSession(): boolean {
  return env.sessionId === 'someValue.sessionId'
}

export { isPrismaNextSchema }

export function checkForOtherPrismaExtension(): void {
  const files = readdirSync(path.join(homedir(), '.vscode/extensions')).filter(
    (file) =>
      file.toLowerCase().startsWith('prisma.prisma-') && !file.toLowerCase().startsWith('prisma.prisma-insider-'),
  )
  if (files.length !== 0) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    window.showInformationMessage(
      `You have both versions (Insider and Stable) of the Prisma VS Code extension enabled in your workspace. Please uninstall or disable one of them for a better experience.`,
    )
    console.log('Both versions (Insider and Stable) of the Prisma VS Code extension are enabled.')
  }
}

function showToastToSwitchColorTheme(currentTheme: string, suggestedTheme: string): void {
  // We do not want to block on this UI message, therefore disabling the linter here.
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  window.showWarningMessage(
    `The VS Code Color Theme '${currentTheme}' you are using unfortunately does not fully support syntax highlighting. We suggest you switch to '${suggestedTheme}' which does fully support it and will give you a better experience.`,
  )
}

export function checkForMinimalColorTheme(): void {
  const colorTheme = workspace.getConfiguration('workbench').get('colorTheme')
  if (!colorTheme) {
    return
  }

  console.log(colorTheme)

  if (denyListDarkColorThemes.includes(colorTheme as string)) {
    showToastToSwitchColorTheme(colorTheme as string, 'Dark+ (Visual Studio)')
  }
  if (denyListLightColorThemes.includes(colorTheme as string)) {
    showToastToSwitchColorTheme(colorTheme as string, 'Light+ (Visual Studio)')
  }
}

export function createLegacyLanguageServer(
  serverOptions: ServerOptions,
  clientOptions: LanguageClientOptions,
): LanguageClient {
  return new LanguageClient('prisma', 'Prisma Legacy Language Server', serverOptions, {
    ...clientOptions,
    outputChannelName: 'Prisma Legacy Language Server',
  })
}
export const restartClient = async (
  context: ExtensionContext,
  client: LanguageClient,
  serverOptions: ServerOptions,
  clientOptions: LanguageClientOptions,
): Promise<LanguageClient> => {
  client?.diagnostics?.dispose()
  if (client) {
    await client.stop()
  }
  client = createLegacyLanguageServer(serverOptions, clientOptions)
  context.subscriptions.push(client.start())
  try {
    await client.onReady()
  } catch (error) {
    // Still return the new client so the caller replaces its stopped predecessor and a
    // later restart can stop this one.
    console.error('Prisma Legacy Language Server failed to start', error)
  }
  return client
}
