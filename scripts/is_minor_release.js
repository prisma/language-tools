const { isMinorRelease } = require('./bump_extension_version')
const { readVersionFile } = require('./util')

if (require.main === module) {
  const args = process.argv.slice(2)
  const releaseChannel = args[0]
  if (releaseChannel === 'latest') {
    const prisma_latest = readVersionFile({ fileName: 'prisma_latest' })
    const isMinor = isMinorRelease(prisma_latest)
    console.log(`::set-output name=is_minor_release::${isMinor}`)
  }
}
