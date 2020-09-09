const execa = require('execa')
const fs = require('fs')
const path = require('path')

function writeToVersionFile({
    fileName = '',
    content
}) {
    fs.writeFileSync(path.join(__dirname, 'versions', `./${fileName}`), content)
}

function readVersionFile({
    fileName = ''
}) {
    return fs.readFileSync(path.join(__dirname, 'versions', `./${fileName}`), {
        encoding: 'utf-8'
    }).replace('\n', '')
}

function getNpmPrismaVersion({ channel }) {
    (async () => {
        const {stdout} = await execa('npm', ['show', `@prisma/cli@${channel}`, 'version']);
        return stdout
    })();
}

function getPackageJsonContent({path}) {
    let content = fs.readFileSync(path, {encoding: "utf-8"})
    return JSON.parse(content)
  }
  
  function writeJsonToPackageJson({content, path}) {
    fs.writeFileSync(path, JSON.stringify(content))
  }

module.exports = { getPackageJsonContent, writeJsonToPackageJson, writeToVersionFile, readVersionFile, getNpmPrismaVersion }

if (require.main === module) {
    getNpmPrismaVersion({channel: "dev"})
}