import nextjs from './nextjs'
import languageServer from './prisma-language-server'
import studio from './prisma-language-server'

import { PrismaVSCodePlugin } from './types'

const plugins: PrismaVSCodePlugin[] = [languageServer, nextjs, studio]

export default plugins
