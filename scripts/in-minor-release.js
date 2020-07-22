function isMinorRelease({
    prismaVersion,
  }) {
      const tokens = prismaVersion.split('.')
      if (tokens.length !== 3) {
        throw new Error(
            `Version ${prismaVersion} must have 3 tokens separated by "." character.`
        )
      }
      console.log(tokens)
      return tokens[2] === '0'
  }


module.exports = { isMinorRelease }

if (require.main === module) {
  const args = process.argv.slice(2)
  const result = isMinorRelease({
    prismaVersion: args[0],
  })
  console.log(result)
}
