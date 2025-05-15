import aiTools from './ai-tools'
import languageServer from './prisma-language-server'
import { PrismaVSCodePlugin } from './types'

const plugins: PrismaVSCodePlugin[] = [languageServer, aiTools]

export default plugins
