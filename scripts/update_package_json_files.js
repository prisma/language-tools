const fs = require('fs')
const execa = require('execa')

function bumpVersionInVSCodeRepo({ version, name, displayName, description, preview }) {
  const vscodePackageJsonPath = './packages/vscode/package.json'
  let content = fs.readFileSync(vscodePackageJsonPath, { encoding: "utf-8" })
  content['version'] = version
  content['name'] = name
  content['displayName'] = displayName
  content['description'] = description
  content['preview'] = preview
  fs.writeFileSync(vscodePackageJsonPath, content)
}

function bumpVersionsInRepo({ channel, newExtensionVersion, newPrismaVersion = '' }) {
  const languageServerPackageJsonPath = './packages/vscode/package.json'
  const rootPackageJsonPath = './package.json'

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
      const { stdout } = await execa('npx', ['-q', `@prisma/cli@2.6.0`, 'version', '--json']);
      let json = JSON.parse(stdout)
      let sha = json["format-binary"].split(/\s+/).slice(1)[0]
      let languageServerPackageJson = fs.readFileSync(
        languageServerPackageJsonPath, { encoding: "utf-8" }
      );
      languageServerPackageJson['prisma']['version'] = sha
      languageServerPackageJson['dependencies']['@prisma/get-platform'] = newPrismaVersion
      fs.writeFileSync(languageServerPackageJsonPath, languageServerPackageJson)
    })();
  }

  // update version in root package.json 
  let rootPackageJson = fs.readFileSync(rootPackageJson, { encoding: "utf-8" })
  rootPackageJson['version'] = newExtensionVersion
  fs.writeFileSync(rootPackageJsonPath, rootPackageJson)
}

module.exports = { bumpVersionsInRepo }

if (require.main === module) {
  const args = process.argv.slice(2)
  if (args.length === 3) {
    bumpVersionsInRepo({
      channel: args[0],
      newExtensionVersion: args[1],
      newPrismaVersion: args[2]
    })
  } else if (args.length === 2) {
    bumpVersionsInRepo({
      channel: args[0],
      newExtensionVersion: args[1]
    })
  } else {
    throw new Error(`Expected 2 or 3 arguments, but received ${args.length}.`)
  }
}