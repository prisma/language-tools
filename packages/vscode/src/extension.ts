import { ExtensionContext } from 'vscode'
import plugins from './plugins'

export function activate(context: ExtensionContext): void {
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

export async function deactivate(): Promise<void> {
  const results = await Promise.allSettled(plugins.map((plugin) => Promise.resolve().then(() => plugin.deactivate?.())))

  for (const [index, result] of results.entries()) {
    if (result.status === 'rejected') {
      console.error(`Failed to deactivate ${plugins[index].name}`, result.reason)
    }
  }
}
