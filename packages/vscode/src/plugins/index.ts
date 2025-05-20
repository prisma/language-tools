import aiTools from './ai-tools'
import languageServer from './prisma-language-server'
import ppgManager from './prisma-postgres-manager'
import studio from './prisma-studio'
import { PrismaVSCodePlugin } from './types'

const plugins: PrismaVSCodePlugin[] = [languageServer, aiTools, ppgManager, studio]

export default plugins
