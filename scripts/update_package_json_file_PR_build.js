const execa = require('execa')
const path = require('path')
const { writeJsonToPackageJson, getPackageJsonContent } = require('./util')

if (require.main === module) {
  ;(async () => {
    const vscodePackageJsonPath = path.join(__dirname, '../packages/vscode/package.json')

    let content = getPackageJsonContent({ path: vscodePackageJsonPath })

    // Change name so VS Code doesn't try to auto-update it to the current Insider version
    content['name'] = 'prisma-insider-pr-build'
    content['displayName'] = `Prisma - Insider - PR ${process.env.PR_NUMBER} Build - ${new Date().toISOString()}`

    writeJsonToPackageJson({ content: content, path: vscodePackageJsonPath })

    // Update pnpm-lock.yaml after package.json changes
    console.log('Running pnpm install to update pnpm-lock.yaml...')
    await execa('pnpm', ['i'], { cwd: path.join(__dirname, '..'), stdio: 'inherit' })
  })().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
