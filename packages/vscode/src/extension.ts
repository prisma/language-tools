/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ExtensionContext } from 'vscode'
import plugins from './plugins'
import { registerChatTools } from './plugins/llmTools'
import * as studio from './ui/studio'
import * as databases from './ui/databases'

export function activate(context: ExtensionContext): void {
  registerChatTools(context)

  databases.activate(context)
  studio.activate(context)

  void plugins.map(async (plugin) => {
    const enabled = await plugin.enabled()
    if (enabled) {
      console.log(`Activating ${plugin.name}`)
      if (plugin.activate) {
        await plugin.activate(context)
      }
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
