import core from '@actions/core'
import { isMinorOrMajorRelease } from './bump_extension_version.mjs'
import { readVersionFile } from './util.mjs'

const args = process.argv.slice(2)
const releaseChannel = args[0]
if (releaseChannel === 'latest') {
  const prisma_latest = readVersionFile({ fileName: 'prisma_latest' })
  const isMinorOrMajor = isMinorOrMajorRelease(prisma_latest)
  core.setOutput('is_minor_or_major_release', isMinorOrMajor)
}

