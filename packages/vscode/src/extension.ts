import { commands, ExtensionContext, window } from 'vscode'
import plugins from './plugins'

export async function activate(context: ExtensionContext): Promise<void> {
  const done = plugins.map(async (plugin) => {
    const enabled = await plugin.enabled()
    if (enabled) {
      void window.showInformationMessage(`Activating ${plugin.name}`)
      plugin.activate && (await plugin.activate(context))
      plugin.commands?.forEach((command) => {
        commands.registerCommand(command.id, () => command.action(context))
      })
    }
  })
  await Promise.all(done)
  return
}

export async function deactivate(): Promise<void> {
  const done = plugins.map(async (plugin) => {
    if (plugin.deactivate) {
      return plugin.deactivate()
    }
  })
  await Promise.all(done)
  return
}
