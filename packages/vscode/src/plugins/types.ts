type PluginCommand = {
  commandId: string
  action: () => Promise<void> | void
}
export interface PrismaVSCodePlugin {
  name: string
  commands: PluginCommand[]
}
