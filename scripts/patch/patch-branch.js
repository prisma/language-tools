function patchBranchName({
    version
}) {
    const tokens = version.split('.')
    if (tokens.length !== 3) {
        throw new Error(
            `Version ${prismaVersion} must have 3 tokens separated by "." character.`
        )
    }
    // remove last digit
    const numbers = tokens.slice(0, 2)

    const patchName = numbers.join('.') + '.x'
    return patchName
}


module.exports = { patchBranchName }

if (require.main === module) {
    const args = process.argv.slice(2)
    name = patchBranchName({
        version: args[0]
    })
    console.log(name)
} 