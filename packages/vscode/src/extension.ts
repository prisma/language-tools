import { commands, ExtensionContext } from 'vscode'
import plugins from './plugins'

export function activate(context: ExtensionContext): void {
  plugins.map(async (plugin) => {
    const enabled = await plugin.enabled()
    if (enabled) {
      console.log(`Activating ${plugin.name}`)
      if (plugin.activate) {
        await plugin.activate(context)
      }
      plugin.commands?.forEach((command) => {
        commands.registerCommand(command.id, () => command.action(context))
      })
    } else {
      console.log(`${plugin.name} is Disabled`)
    }
  })
}

export function deactivate(): void {
  plugins.forEach((plugin) => {
    if (plugin.deactivate) {
      void plugin.deactivate()
    }
  })
}
