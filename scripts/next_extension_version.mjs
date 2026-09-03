import semVer from 'semver'
import core from '@actions/core'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { argv } from 'process'

const BUMPS = ['auto', 'patch', 'minor', 'major']

// The extension version is a single monotonic counter shared by both channels.
// It is derived from the release tags (`x.y.z` for stable, `insider/x.y.z` for
// insider) instead of a committed version file, so releasing does not require
// any bot commits.
export function latestReleasedVersion({ tags }) {
  const versions = tags
    .map((tag) => tag.replace(/^insider\//, ''))
    .filter((tag) => semVer.valid(tag))
    .sort(semVer.rcompare)

  if (versions.length === 0) {
    throw new Error('Could not find any release tags (`x.y.z` or `insider/x.y.z`) to derive the next version from.')
  }
  return versions[0]
}

export function releaseType({ channel, bump = 'auto', prismaVersion = '' }) {
  if (channel === 'insider') {
    return 'patch'
  }
  if (channel !== 'stable') {
    throw new Error(`Unknown release channel '${channel}'. Expected 'insider' or 'stable'.`)
  }
  if (!BUMPS.includes(bump)) {
    throw new Error(`Unknown bump '${bump}'. Expected one of: ${BUMPS.join(', ')}.`)
  }
  if (bump !== 'auto') {
    return bump
  }
  // 'auto' on stable mirrors the Prisma CLI release this extension ships:
  // x.0.0 -> major, x.y.0 -> minor, everything else (or no CLI bump) -> patch
  if (prismaVersion !== '') {
    const [, minor, patch] = prismaVersion.split('.')
    if (minor === '0' && patch === '0') {
      return 'major'
    }
    if (patch === '0') {
      return 'minor'
    }
  }
  return 'patch'
}

export function planRelease({ channel, bump, prismaVersion, tags }) {
  const currentVersion = latestReleasedVersion({ tags })
  const type = releaseType({ channel, bump, prismaVersion })
  const version = semVer.inc(currentVersion, type)
  const stable = channel === 'stable'

  return {
    version,
    release_type: type,
    tag_name: stable ? version : `insider/${version}`,
    asset_name: stable ? 'prisma' : 'prisma-insider',
    // npm dist-tag for @prisma/language-server
    ls_npm_tag: stable ? 'latest' : 'dev',
    // channel name understood by update_package_json_files.mjs
    npm_channel: stable ? 'latest' : 'dev',
  }
}

// Only run top-level code if this file is being executed directly (not imported)
if (fileURLToPath(import.meta.url) === argv[1]) {
  const [channel, bump = 'auto', prismaVersion = ''] = process.argv.slice(2)
  const tags = execSync('git tag --list', { encoding: 'utf-8' }).split('\n')

  const plan = planRelease({ channel, bump, prismaVersion, tags })
  console.log(plan)
  for (const [key, value] of Object.entries(plan)) {
    core.setOutput(key, value)
  }
}
