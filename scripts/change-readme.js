const fs = require('fs')
const githubAction = require('@actions/github')
const path = require('path')


function changeReadme({
  releaseChannel,
  npmVersion
}) {
  if (releaseChannel === 'dev' || releaseChannel === 'patch-dev') {
    let content = fs.readFileSync(
      path.join(__dirname, "./README_INSIDER_BUILD.md"),
      {
        encoding: "utf-8",
      }
    );
    content = content.replace(/\$commit-sha\$/g, githubAction.context.sha)
    content = content.replace(/\$prisma-cli-version\$/g, npmVersion)
    fs.writeFileSync( "./packages/vscode/README.md", content);
  } else {
     content = fs.readFileSync(
      path.join(__dirname, "./README_STABLE_BUILD.md"),
      {
        encoding: "utf-8",
      }
    )
    content = content.replace(/\$prisma-cli-version\$/g, npmVersion)
    fs.writeFileSync("./packages/vscode/README.md", content);
  }
}


module.exports = { changeReadme }

if (require.main === module) {
  const args = process.argv.slice(2)
  changeReadme({
    releaseChannel: args[0],
    npmVersion: args[1] 
  })
}