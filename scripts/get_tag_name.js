const core = require('@actions/core')

if (require.main === module) {
  const args = process.argv.slice(2)
  const releaseChannel = args[0]
  const vscodeVersion = args[1]

  if (releaseChannel === 'stable') {
    core.setOutput('tag_name', vscodeVersion)
    core.setOutput('asset_name', 'prisma')
  } else {
    core.setOutput('tag_name', `insider/${vscodeVersion}`)
    core.setOutput('asset_name', 'prisma-insider')
  }
}
