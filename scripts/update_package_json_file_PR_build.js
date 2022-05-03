const path = require('path')
const { writeJsonToPackageJson, getPackageJsonContent } = require('./util')

if (require.main === module) {
  const vscodePackageJsonPath = path.join(__dirname, '../packages/vscode/package.json')

  let content = getPackageJsonContent({ path: vscodePackageJsonPath })

  // Change name so VS Code doesn't try to auto-update it to the current Insider version
  content['name'] = 'prisma-insider-pr-build'
  content['displayName'] = `Prisma - Insider - PR ${PR_NUMBER} Build`

  writeJsonToPackageJson({ content: content, path: vscodePackageJsonPath })
}
