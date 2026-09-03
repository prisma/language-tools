import { describe, it, expect } from 'vitest'
import { latestReleasedVersion, releaseType, planRelease } from '../next_extension_version.mjs'

const TAGS = [
  '31.11.0',
  '31.12.0',
  'insider/31.10.5',
  'insider/31.11.1',
  '@prisma/language-server@0.0.1307',
  'prisma-vscode@0.0.45',
  '',
]

describe('latestReleasedVersion', () => {
  it('picks the highest version across stable and insider tags', () => {
    expect(latestReleasedVersion({ tags: TAGS })).toEqual('31.12.0')
  })

  it('picks an insider tag when it is the highest', () => {
    expect(latestReleasedVersion({ tags: ['31.12.0', 'insider/31.12.1'] })).toEqual('31.12.1')
  })

  it('throws when there are no release tags', () => {
    expect(() => latestReleasedVersion({ tags: ['prisma-vscode@0.0.45'] })).toThrow()
  })
})

describe('releaseType', () => {
  it('insider releases are always a patch', () => {
    expect(releaseType({ channel: 'insider', bump: 'auto', prismaVersion: '7.9.0-dev.4' })).toEqual('patch')
  })

  it('stable release for a Prisma CLI patch', () => {
    expect(releaseType({ channel: 'stable', bump: 'auto', prismaVersion: '7.8.1' })).toEqual('patch')
  })

  it('stable release for a Prisma CLI minor', () => {
    expect(releaseType({ channel: 'stable', bump: 'auto', prismaVersion: '7.9.0' })).toEqual('minor')
  })

  it('stable release for a Prisma CLI major', () => {
    expect(releaseType({ channel: 'stable', bump: 'auto', prismaVersion: '8.0.0' })).toEqual('major')
  })

  it('stable extension-only release defaults to a patch', () => {
    expect(releaseType({ channel: 'stable', bump: 'auto' })).toEqual('patch')
  })

  it('an explicit bump wins over the Prisma CLI version', () => {
    expect(releaseType({ channel: 'stable', bump: 'minor', prismaVersion: '7.8.1' })).toEqual('minor')
  })

  it('throws on an unknown channel', () => {
    expect(() => releaseType({ channel: 'nightly' })).toThrow()
  })

  it('throws on an unknown bump', () => {
    expect(() => releaseType({ channel: 'stable', bump: 'mega' })).toThrow()
  })
})

describe('planRelease', () => {
  it('plans an insider release', () => {
    expect(planRelease({ channel: 'insider', bump: 'auto', prismaVersion: '7.9.0-dev.4', tags: TAGS })).toEqual({
      version: '31.12.1',
      release_type: 'patch',
      tag_name: 'insider/31.12.1',
      asset_name: 'prisma-insider',
      ls_npm_tag: 'dev',
      npm_channel: 'dev',
    })
  })

  it('plans a stable release for a Prisma CLI minor', () => {
    expect(planRelease({ channel: 'stable', bump: 'auto', prismaVersion: '7.9.0', tags: TAGS })).toEqual({
      version: '31.13.0',
      release_type: 'minor',
      tag_name: '31.13.0',
      asset_name: 'prisma',
      ls_npm_tag: 'latest',
      npm_channel: 'latest',
    })
  })
})
