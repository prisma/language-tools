const fs = require('fs')
const githubAction = require('@actions/github')
const path = require('path')
const { readVersionFile } = require('./util')

function getNewReadMeContent({ trigger, npmVersion, githubActionContextSha }) {
  if (trigger === 'stable-release') {
    content = fs.readFileSync(path.join(__dirname, './README_STABLE_BUILD.md'), {
      encoding: 'utf-8',
    })
    return content.replace(/\$prisma-cli-version\$/g, npmVersion)
  } else {
    let content = fs.readFileSync(path.join(__dirname, './README_INSIDER_BUILD.md'), {
      encoding: 'utf-8',
    })
    content = content.replace(/\$commit-sha\$/g, githubActionContextSha)
    return content.replace(/\$prisma-cli-version\$/g, npmVersion)
  }
}

function changeReadme({ trigger }) {
  // ignoring patch-dev here, but it doesn't really matter
  const prismaChannel = trigger === 'stable-release' ? 'latest' : 'dev'
  const cliVersion = readVersionFile({ fileName: `prisma_${prismaChannel}` })
  const sha = githubAction.context.sha
  const content = getNewReadMeContent({
    trigger,
    npmVersion: cliVersion,
    githubActionContextSha: sha,
  })
  fs.writeFileSync('./packages/vscode/README.md', content)
}

module.exports = { changeReadme, getNewReadMeContent }

if (require.main === module) {
  const args = process.argv.slice(2)
  changeReadme({
    trigger: args[0],
  })
}
