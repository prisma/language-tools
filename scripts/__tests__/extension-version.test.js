const { nextVersion } = require('./../bump_extension_version')

describe('next extension version', () => {
  // normal insider release
  it('it should work with an insider release triggered by Prisma CLI', () => {
    expect(
      nextVersion({
        currentVersion: '5.0.1',
        branch_channel: 'dev',
        prisma_latest: '2.4.0',
        prisma_dev: '2.5.0-dev.2',
        prisma_patch: '2.4.1-dev.3',
      }),
    ).toEqual('5.0.2')
  })

  it('it should work with an insider release triggered by Prisma CLI after an extension only release', () => {
    expect(
      nextVersion({
        currentVersion: '5.0.2',
        branch_channel: 'dev',
        prisma_latest: '2.4.0',
        prisma_dev: '2.5.0-dev.2',
        prisma_patch: '2.4.1-dev.3',
      }),
    ).toEqual('5.0.3')
  })

  // patches
  it('it should work with a first patch release after Prisma CLI stable on Insider', () => {
    expect(
      nextVersion({
        currentVersion: '2.2.1',
        branch_channel: '2.3.x',
        prisma_latest: '2.3.0',
        prisma_dev: '2.4.0-dev.2',
        prisma_patch: '2.2.1-dev.3',
      }),
    ).toEqual('3.1.1')
  })

  it('it should work with a second patch release after Prisma CLI stable on Insider', () => {
    expect(
      nextVersion({
        currentVersion: '3.1.1',
        branch_channel: '2.3.x',
        prisma_latest: '2.3.0',
        prisma_dev: '2.4.0-dev.2',
        prisma_patch: '2.3.1-dev.3',
      }),
    ).toEqual('3.1.2')
  })

  it('it should work with a first Prisma CLI patch on stable', () => {
    expect(
      nextVersion({
        currentVersion: '2.5.0',
        branch_channel: 'latest',
        prisma_latest: '2.5.1',
        prisma_dev: '2.6.0-dev.2',
        prisma_patch: '2.4.1-dev.3',
      }),
    ).toEqual('2.5.1')
  })

  it('it should work with a Prisma CLI patch on stable', () => {
    expect(
      nextVersion({
        currentVersion: '2.5.1',
        branch_channel: 'latest',
        prisma_latest: '2.5.1',
        prisma_dev: '2.6.0-dev.2',
        prisma_patch: '2.4.1-dev.3',
      }),
    ).toEqual('2.5.2')
  })

  // first extension release after Prisma CLI minor update

  it('it should work with the first extension release after a minor Prisma CLI update', () => {
    expect(
      nextVersion({
        currentVersion: '5.1.3',
        branch_channel: 'main',
        prisma_latest: '2.5.0',
        prisma_dev: '2.5.1-dev.2',
        prisma_patch: '2.4.1-dev.3',
      }),
    ).toEqual('6.0.1')
  })

  // first extension release after Prisma CLI major update

  it('it should work with the first extension release after special major Prisma CLI update (3.0.1)', () => {
    expect(
      nextVersion({
        currentVersion: '2.30.3',
        branch_channel: 'latest',
        prisma_latest: '3.0.1',
        prisma_dev: '0.0.0-dev.0',
        prisma_patch: '0.0.0-dev.0',
      }),
    ).toEqual('3.0.1')
  })

  it('it should work with the first extension release after a major Prisma CLI update (4.0.0)', () => {
    expect(
      nextVersion({
        currentVersion: '3.15.9',
        branch_channel: 'latest',
        prisma_latest: '4.0.0',
        prisma_dev: '0.0.0-dev.0',
        prisma_patch: '0.0.0-dev.0',
      }),
    ).toEqual('4.0.0')
  })
})
