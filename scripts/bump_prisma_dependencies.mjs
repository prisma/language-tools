import execa from 'execa'
import path from 'path'
import { fileURLToPath } from 'url'
import { argv } from 'process'
import { writeJsonToPackageJson, getPackageJsonContent } from './util.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export async function enginesVersionFor(prismaVersion) {
  const { stdout } = await execa('pnpm', ['show', `@prisma/engines@${prismaVersion}`, 'dependencies', '--json'])
  const engineVersion = JSON.parse(stdout)['@prisma/engines-version']
  if (typeof engineVersion !== 'string') {
    throw new Error(`@prisma/engines@${prismaVersion} does not declare an @prisma/engines-version dependency.`)
  }
  return engineVersion
}

export function applyPrismaVersion({ packageJson, prismaVersion, engineVersion }) {
  const engineSha = engineVersion.split('.')[3]
  if (!engineSha) {
    throw new Error(`Could not read an engine sha out of '${engineVersion}'.`)
  }
  return {
    ...packageJson,
    prisma: { ...packageJson.prisma, enginesVersion: engineSha, cliVersion: prismaVersion },
    dependencies: {
      ...packageJson.dependencies,
      '@prisma/config': prismaVersion,
      '@prisma/prisma-schema-wasm': engineVersion,
      '@prisma/schema-files-loader': prismaVersion,
    },
  }
}

if (fileURLToPath(import.meta.url) === argv[1]) {
  const [prismaVersion] = argv.slice(2)
  if (!prismaVersion) {
    throw new Error('Expected a Prisma CLI version, for example: node scripts/bump_prisma_dependencies.mjs 7.9.0')
  }
  const packageJsonPath = path.join(__dirname, '../packages/language-server/package.json')
  const engineVersion = await enginesVersionFor(prismaVersion)
  console.log({ prismaVersion, engineVersion })
  writeJsonToPackageJson({
    content: applyPrismaVersion({
      packageJson: getPackageJsonContent({ path: packageJsonPath }),
      prismaVersion,
      engineVersion,
    }),
    path: packageJsonPath,
  })
}
