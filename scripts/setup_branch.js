const fs = require('fs')
const path = require('path')

function patchBranchName() {
  const prismaStableVersion = fs.readFileSync(path.join(__dirname, './prisma_latest')).toString()
  const tokens = prismaStableVersion.split('.')
  if (tokens.length !== 3) {
      throw new Error(
          `Version ${version} must have 3 tokens separated by "." character.`
      )
  }
  // remove last digit
  const numbers = tokens.slice(0, 2)

  const patchName = numbers.join('.') + '.x'
  return patchName
}

function getBranchName({
  branch_channel = ''
}) {
  switch (branch_channel) {
    case 'latest':
      return 'stable'
    case 'patch-dev':
      return patchBranchName()
  }
}


module.exports = { getBranchName, checkoutBranch}

if (require.main === module) {
  const args = process.argv.slice(2)
  getBranchName({
    branch_channel: args[0],
  })
}