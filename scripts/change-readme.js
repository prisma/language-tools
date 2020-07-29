const fs = require('fs')
const githubAction = require('@actions/github')
const path = require('path')


function getNewReadMeContent({
  releaseChannel,
  npmVersion,
  githubActionContextSha
}) {
  if (releaseChannel === 'dev' || releaseChannel === 'patch-dev') {
    let content = fs.readFileSync(
      path.join(__dirname, "./README_INSIDER_BUILD.md"),
      {
        encoding: "utf-8",
      }
    );
    content = content.replace(/\$commit-sha\$/g, githubActionContextSha)
    return content.replace(/\$prisma-cli-version\$/g, npmVersion)
  } else {
    content = fs.readFileSync(
      path.join(__dirname, "./README_STABLE_BUILD.md"),
      {
        encoding: "utf-8",
      }
    )
    return content.replace(/\$prisma-cli-version\$/g, npmVersion)
  }
}



function changeReadme({
  releaseChannel,
  npmVersion
}) {
  const content = getNewReadMeContent(releaseChannel, npmVersion, githubAction.context.sha)
  fs.writeFileSync("./packages/vscode/README.md", content);
}


module.exports = { changeReadme, getNewReadMeContent }

if (require.main === module) {
  const args = process.argv.slice(2)
  changeReadme({
    releaseChannel: args[0],
    npmVersion: args[1]
  })
}