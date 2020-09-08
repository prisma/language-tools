const execa = require('execa')

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

module.exports = { writeToVersionFile, readVersionFile, getNpmPrismaVersion }

if (require.main === module) {
    getNpmPrismaVersion({channel: "dev"})
}