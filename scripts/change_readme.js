const fs = require('fs')
const githubAction = require('@actions/github')
const path = require('path')
const lsPackageJson = require(path.join(__dirname, '../packages/language-server/package.json')) // eslint-disable-line

function getNewReadMeContent({ releaseChannel, cliVersion, githubActionContextSha }) {
  if (releaseChannel === 'stable') {
    content = fs.readFileSync(path.join(__dirname, './README_STABLE_BUILD.md'), {
      encoding: 'utf-8',
    })
    return content.replace(/\$prisma-cli-version\$/g, cliVersion)
  } else {
    let content = fs.readFileSync(path.join(__dirname, './README_INSIDER_BUILD.md'), {
      encoding: 'utf-8',
    })
    content = content.replace(/\$commit-sha\$/g, githubActionContextSha)
    return content.replace(/\$prisma-cli-version\$/g, cliVersion)
  }
}

function changeReadme({ releaseChannel }) {
  const sha = githubAction.context.sha
  const content = getNewReadMeContent({
    releaseChannel,
    cliVersion: lsPackageJson.prisma.cliVersion,
    githubActionContextSha: sha,
  })
  fs.writeFileSync('./packages/vscode/README.md', content)
}

module.exports = { changeReadme, getNewReadMeContent }

if (require.main === module) {
  const args = process.argv.slice(2)
  changeReadme({
    releaseChannel: args[0],
  })
}
