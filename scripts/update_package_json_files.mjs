import execa from 'execa'
import path from 'path'
import { fileURLToPath } from 'url'
import { writeJsonToPackageJson, getPackageJsonContent } from './util.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function bumpVersionInVSCodeRepo({ version, name, displayName, description, preview }) {
  const vscodePackageJsonPath = path.join(__dirname, '../packages/vscode/package.json')
  const content = getPackageJsonContent({ path: vscodePackageJsonPath })
  content['version'] = version
  content['name'] = name
  content['displayName'] = displayName
  content['description'] = description
  content['preview'] = preview
  writeJsonToPackageJson({ content: content, path: vscodePackageJsonPath })
}

async function bumpVersionsInRepo({ channel, newExtensionVersion }) {
  const languageServerPackageJsonPath = path.join(__dirname, '../packages/language-server/package.json')
  const rootPackageJsonPath = path.join(__dirname, '../package.json')

  // update version in packages/vscode folder
  if (channel === 'dev' || channel === 'patch-dev') {
    // change name, displayName, description and preview flag to Insider extension
    bumpVersionInVSCodeRepo({
      version: newExtensionVersion,
      name: 'prisma-insider',
      displayName: 'Prisma - Insider',
      description:
        'This is the Insider Build of the Prisma VS Code extension (only use it if you are also using the dev version of the CLI).',
      preview: true,
    })
  } else {
    bumpVersionInVSCodeRepo({
      version: newExtensionVersion,
      name: 'prisma',
      displayName: 'Prisma',
      description:
        'Adds syntax highlighting, formatting, auto-completion, jump-to-definition and linting for .prisma files.',
      preview: false,
    })
  }

  // update version in root package.json
  const rootPackageJson = getPackageJsonContent({ path: rootPackageJsonPath })
  rootPackageJson['version'] = newExtensionVersion
  writeJsonToPackageJson({
    content: rootPackageJson,
    path: rootPackageJsonPath,
  })

  // update version in Language Server
  const lsPackageJsonPath = path.join(__dirname, '../packages/language-server/package.json')
  const lspPackageJson = getPackageJsonContent({ path: lsPackageJsonPath })
  lspPackageJson['version'] = newExtensionVersion
  writeJsonToPackageJson({ content: lspPackageJson, path: lsPackageJsonPath })

  // Update pnpm-lock.yaml after package.json changes
  console.log('Running pnpm install to update pnpm-lock.yaml...')
  await execa('pnpm', ['install', '--no-frozen-lockfile'], { cwd: path.join(__dirname, '..'), stdio: 'inherit' })
}

export { bumpVersionsInRepo }

const args = process.argv.slice(2)
if (args.length !== 2) {
  throw new Error(`Expected 2 arguments (channel, version), but received ${args.length}.`)
}
console.log('Bumping extension and Language Server version in repo.')
await bumpVersionsInRepo({ channel: args[0], newExtensionVersion: args[1] })
