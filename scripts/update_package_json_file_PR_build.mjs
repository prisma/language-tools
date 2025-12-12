import execa from 'execa'
import path from 'path'
import { fileURLToPath } from 'url'
import { writeJsonToPackageJson, getPackageJsonContent } from './util.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const vscodePackageJsonPath = path.join(__dirname, '../packages/vscode/package.json')

const content = getPackageJsonContent({ path: vscodePackageJsonPath })

// Change name so VS Code doesn't try to auto-update it to the current Insider version
content['name'] = 'prisma-insider-pr-build'
content['displayName'] = `Prisma - Insider - PR ${process.env.PR_NUMBER} Build - ${new Date().toISOString()}`

writeJsonToPackageJson({ content: content, path: vscodePackageJsonPath })

// Update pnpm-lock.yaml after package.json changes
console.log('Running pnpm install to update pnpm-lock.yaml...')
await execa('pnpm', ['install'], { cwd: path.join(__dirname, '..'), stdio: 'inherit' })

