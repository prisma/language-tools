import fs from 'fs'
import githubAction from '@actions/github'
import path from 'path'
import { fileURLToPath } from 'url'
import { argv } from 'process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const lsPackageJson = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../packages/language-server/package.json'),
    'utf-8',
  ),
)

export function getNewReadMeContent({ releaseChannel, cliVersion, githubActionContextSha }) {
  if (releaseChannel === 'stable') {
    const content = fs.readFileSync(
      path.join(__dirname, './README_STABLE_BUILD.md'),
      {
        encoding: 'utf-8',
      },
    )
    return content.replace(/\$prisma-cli-version\$/g, cliVersion)
  } else {
    let content = fs.readFileSync(
      path.join(__dirname, './README_INSIDER_BUILD.md'),
      {
        encoding: 'utf-8',
      },
    )
    content = content.replace(/\$commit-sha\$/g, githubActionContextSha)
    return content.replace(/\$prisma-cli-version\$/g, cliVersion)
  }
}

export function changeReadme({ releaseChannel }) {
  const sha = githubAction.context.sha
  const content = getNewReadMeContent({
    releaseChannel,
    cliVersion: lsPackageJson.prisma.cliVersion,
    githubActionContextSha: sha,
  })
  fs.writeFileSync('./packages/vscode/README.md', content)
}

// Only run top-level code if this file is being executed directly (not imported)
if (fileURLToPath(import.meta.url) === argv[1]) {
  const args = process.argv.slice(2)
  changeReadme({
    releaseChannel: args[0],
  })
}

