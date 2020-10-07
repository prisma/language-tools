import nextjs from './nextjs'
import languageServer from './prisma-language-server'
import studio from './studio'
import { PrismaVSCodePlugin } from './types'

const plugins: PrismaVSCodePlugin[] = [nextjs, studio, languageServer]

export default plugins
