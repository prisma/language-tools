const fs = require('fs')
const githubAction = require('@actions/github')
const path = require('path')


function changeReadme({
  releaseChannel
}) {
  if (releaseChannel === 'dev') {
    let content = fs.readFileSync(
      path.join(__dirname, "./README_INSIDER_BUILD.md"),
      {
        encoding: "utf-8",
      }
    );
    content = content.replace(/\$commit-sha\$/g, githubAction.context.sha)
    fs.writeFileSync( "./README.md", content);
  } else {
     content = fs.readFileSync(
      path.join(__dirname, "./README_STABLE_BUILD.md"),
      {
        encoding: "utf-8",
      }
    )
    fs.writeFileSync("./README.md", content);
  }
}


module.exports = { changeReadme }

if (require.main === module) {
  const args = process.argv.slice(1)
  changeReadme({
    releaseChannel: args[0]
  })
}