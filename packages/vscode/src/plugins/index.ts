import aiTools from './ai-tools'
import languageServer from './prisma-language-server'
import ppgManager from './prisma-postgres-manager'
import { PrismaVSCodePlugin } from './types'

const plugins: PrismaVSCodePlugin[] = [languageServer, aiTools, ppgManager]

export default plugins
