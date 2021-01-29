const execa = require('execa')
const path = require('path')
const {writeJsonToPackageJson, getPackageJsonContent } = require('./util')

function bumpVersionInVSCodeRepo({ version, name, displayName, description, preview }) {
  const vscodePackageJsonPath = path.join(__dirname, '../packages/vscode/package.json')
  let content = getPackageJsonContent({path: vscodePackageJsonPath})
  content['version'] = version
  content['name'] = name
  content['displayName'] = displayName
  content['description'] = description
  content['preview'] = preview
  writeJsonToPackageJson({content: content, path: vscodePackageJsonPath})
}

function bumpLSPVersionInExtension({version}) {
  const vscodePackageJsonPath = path.join(__dirname, '../packages/vscode/package.json')
  let content = getPackageJsonContent({path: vscodePackageJsonPath})
  content['dependencies']['@prisma/language-server'] = version
  writeJsonToPackageJson({content: content, path: vscodePackageJsonPath})
}

function bumpVersionsInRepo({ channel, newExtensionVersion, newPrismaVersion = '' }) {
  const languageServerPackageJsonPath = path.join(__dirname, '../packages/language-server/package.json')
  const rootPackageJsonPath = path.join(__dirname, '../package.json')

  // update version in packages/vscode folder
  if (channel === 'dev' || channel === 'patch-dev') {
    // change name, displayName, description and preview flag to Insider extension
    bumpVersionInVSCodeRepo({
      version: newExtensionVersion,
      name: "prisma-insider",
      displayName: "Prisma - Insider",
      description: "This is the Insider Build of the Prisma VSCode extension (only use it if you are also using the dev version of the CLI.",
      preview: true
    })
  } else {
    bumpVersionInVSCodeRepo({
      version: newExtensionVersion,
      name: "prisma",
      displayName: "Prisma",
      description: "Adds syntax highlighting, formatting, auto-completion, jump-to-definition and linting for .prisma files.",
      preview: false
    })
  }

  // update Prisma CLI version in packages/language-server folder
  if (newPrismaVersion !== '') {
    (async () => {
      const { stdout } = await execa('npx', ['-q', `prisma@${newPrismaVersion}`, 'version', '--json']);
      let json = JSON.parse(stdout)
      let sha = json["format-binary"].split(/\s+/).slice(1)[0]
      let languageServerPackageJson = getPackageJsonContent({path: languageServerPackageJsonPath})
      languageServerPackageJson['prisma']['version'] = sha
      languageServerPackageJson['dependencies']['@prisma/get-platform'] = newPrismaVersion
      languageServerPackageJson['dependencies']['@prisma/fetch-engine'] = newPrismaVersion
      writeJsonToPackageJson({content: languageServerPackageJson, path: languageServerPackageJsonPath})
    })();
  }

  // update version in root package.json 
  let rootPackageJson = getPackageJsonContent({path: rootPackageJsonPath})
  rootPackageJson['version'] = newExtensionVersion
  writeJsonToPackageJson({content: rootPackageJson, path: rootPackageJsonPath})

  // update version in LSP
  const lspPackageJsonPath = path.join(__dirname, '../packages/language-server/package.json')
  let lspPackageJson = getPackageJsonContent({path: lspPackageJsonPath})
  lspPackageJson['version'] = newExtensionVersion
  writeJsonToPackageJson({content: lspPackageJson, path: lspPackageJsonPath})
}

module.exports = { bumpVersionsInRepo }

if (require.main === module) {
  const args = process.argv.slice(2)
  if (args.length === 3) {
    console.log("Bumping Prisma CLI version, extension and LSP version in repo.")
    bumpVersionsInRepo({
      channel: args[0],
      newExtensionVersion: args[1],
      newPrismaVersion: args[2]
    })
  } else if (args.length === 2) {
    console.log("Bumping extension and LSP version in repo.")
    bumpVersionsInRepo({
      channel: args[0],
      newExtensionVersion: args[1]
    })
  } else if (args.length === 1) {
    // only bump LSP version in extension
    console.log("Bumping LSP version in extension.")
    bumpLSPVersionInExtension({
      version: args[0]
    })
  } else {
    throw new Error(`Expected 1, 2 or 3 arguments, but received ${args.length}.`)
  }
}