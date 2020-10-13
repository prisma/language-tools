import nextjs from './nextjs'
import languageServer from './prisma-language-server'
import { PrismaVSCodePlugin } from './types'

const plugins: PrismaVSCodePlugin[] = [languageServer, nextjs]

export default plugins
