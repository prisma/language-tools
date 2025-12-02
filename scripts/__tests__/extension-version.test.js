const { nextVersion } = require('./../bump_extension_version')

describe('next extension version', () => {
  //
  // normal insider release
  //
  it('insider release triggered by Prisma CLI', () => {
    expect(
      nextVersion({
        currentVersion: '35.0.1',
        trigger: 'prisma-dev-release',
        prismaLatest: '2.4.0',
      }),
    ).toEqual('35.0.2')
  })

  it('insider release triggered by Prisma CLI after an extension only release', () => {
    expect(
      nextVersion({
        currentVersion: '35.0.2',
        trigger: 'prisma-dev-release',
        prismaLatest: '2.4.0',
      }),
    ).toEqual('35.0.3')
  })

  it('a first Prisma CLI patch on stable', () => {
    expect(
      nextVersion({
        currentVersion: '32.5.0',
        trigger: 'prisma-latest-release',
        prismaLatest: '2.5.1',
      }),
    ).toEqual('32.5.1')
  })

  it('a Prisma CLI patch on stable', () => {
    expect(
      nextVersion({
        currentVersion: '32.5.1',
        trigger: 'prisma-latest-release',
        prismaLatest: '2.5.1',
      }),
    ).toEqual('32.5.2')
  })

  //
  // extension version bumps
  //
  it('patch version bump', () => {
    expect(
      nextVersion({
        currentVersion: '35.1.3',
        trigger: 'extension-patch-release',
        prismaLatest: '2.5.0',
      }),
    ).toEqual('35.1.4')
  })

  it('minor version bump', () => {
    expect(
      nextVersion({
        currentVersion: '35.1.3',
        trigger: 'extension-minor-release',
        prismaLatest: '2.5.0',
      }),
    ).toEqual('35.2.0')
  })

  it('major version bump', () => {
    expect(
      nextVersion({
        currentVersion: '35.1.3',
        trigger: 'extension-major-release',
        prismaLatest: '2.5.0',
      }),
    ).toEqual('36.0.0')
  })

  //
  // first extension release after Prisma CLI major update
  //
  it('first extension release after a major Prisma CLI update (4.0.0)', () => {
    expect(
      nextVersion({
        currentVersion: '32.15.9',
        trigger: 'prisma-latest-release',
        prismaLatest: '4.0.0',
      }),
    ).toEqual('33.0.0')
  })
})
