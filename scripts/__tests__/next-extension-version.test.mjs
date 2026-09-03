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
    expect(releaseType({ channel: 'insider', bump: 'major' })).toEqual('patch')
  })

  it('stable releases use the requested bump', () => {
    expect(releaseType({ channel: 'stable', bump: 'patch' })).toEqual('patch')
    expect(releaseType({ channel: 'stable', bump: 'minor' })).toEqual('minor')
    expect(releaseType({ channel: 'stable', bump: 'major' })).toEqual('major')
  })

  it('stable defaults to a patch', () => {
    expect(releaseType({ channel: 'stable' })).toEqual('patch')
  })

  it('throws on an unknown channel', () => {
    expect(() => releaseType({ channel: 'nightly' })).toThrow()
  })

  it('throws on an unknown bump', () => {
    expect(() => releaseType({ channel: 'stable', bump: 'mega' })).toThrow()
  })

  it('throws on the removed auto bump', () => {
    expect(() => releaseType({ channel: 'stable', bump: 'auto' })).toThrow()
  })
})

describe('planRelease', () => {
  it('plans an insider release', () => {
    expect(planRelease({ channel: 'insider', bump: 'patch', tags: TAGS })).toEqual({
      version: '31.12.1',
      release_type: 'patch',
      tag_name: 'insider/31.12.1',
      asset_name: 'prisma-insider',
      ls_npm_tag: 'dev',
      npm_channel: 'dev',
    })
  })

  it('plans a stable minor release', () => {
    expect(planRelease({ channel: 'stable', bump: 'minor', tags: TAGS })).toEqual({
      version: '31.13.0',
      release_type: 'minor',
      tag_name: '31.13.0',
      asset_name: 'prisma',
      ls_npm_tag: 'latest',
      npm_channel: 'latest',
    })
  })
})
