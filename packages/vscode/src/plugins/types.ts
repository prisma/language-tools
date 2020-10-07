import { ExtensionContext } from 'vscode'

type PluginCommand = {
  id: string
  action: (context: ExtensionContext) => Promise<void> | void
}
export interface PrismaVSCodePlugin {
  name: string
  commands?: PluginCommand[]
  enabled: () => Promise<boolean> | boolean

  activate?: (context: ExtensionContext) => Promise<void> | void
  deactivate?: () => Promise<void> | void
}
