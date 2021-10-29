const fs = require('fs')
const path = require('path')

function patchBranchName() {
  const prismaStableVersion = fs
    .readFileSync(path.join(__dirname, 'versions', './prisma_latest'))
    .toString()
  const tokens = prismaStableVersion.split('.')
  if (tokens.length !== 3) {
    throw new Error(
      `Version ${version} must have 3 tokens separated by "." character.`,
    )
  }
  // remove last digit
  const numbers = tokens.slice(0, 2)

  const patchName = numbers.join('.') + '.x'
  return patchName
}

function getBranchName({ branch_channel = '' }) {
  switch (branch_channel) {
    case 'latest':
      return 'stable'
    case 'patch-dev':
      return patchBranchName()
    default:
      throw new Error(
        'Switching to another branch is only possible if on latest or patch-dev channel.',
      )
  }
}

module.exports = { getBranchName }

if (require.main === module) {
  const args = process.argv.slice(2)
  const branchName = getBranchName({
    branch_channel: args[0],
  })
  console.log(branchName)
}
