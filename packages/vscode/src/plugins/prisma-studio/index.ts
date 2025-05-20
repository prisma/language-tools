import { ExtensionContext, commands } from 'vscode'
import { PrismaVSCodePlugin } from '../types'
import { launch } from './commands/launch'

export default {
  name: 'Studio',
  enabled() {
    return true
  },
  async activate(context: ExtensionContext) {
    context.subscriptions.push(commands.registerCommand('prisma.studio.launch', () => launch({ context })))
  },
  deactivate() {},
} satisfies PrismaVSCodePlugin
