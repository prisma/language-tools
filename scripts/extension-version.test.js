const { expect } = require('chai')

const { nextExtensionVersion } = require('./extension-version')

describe('next extension version', () => {
  // stable channel

  it('it should work with stable channel and current version to new version schema', () => {
    expect(
      nextExtensionVersion({
        prismaVersion: '2.0.0-beta.3',
        extensionVersion: '0.0.35',
      }),
    ).to.eq('0.1.3')
  })

  it('it should work with stable channel and extension only push', () => {
    expect(
      nextExtensionVersion({
        prismaVersion: '2.0.0-beta.3',
        extensionVersion: '0.0.3',
      }),
    ).to.eq('0.1.3.1')
  })

  it('it should work with stable channel and new prisma version', () => {
    expect(
      nextExtensionVersion({
        prismaVersion: '2.0.0-beta.4',
        extensionVersion: '0.0.3',
      }),
    ).to.eq('0.1.4')
  })

  it('it should work with stable channel and new prisma version after an extension only publish', () => {
    expect(
      nextExtensionVersion({
        prismaVersion: '2.0.0-beta.4',
        extensionVersion: '0.0.3.1',
      }),
    ).to.eq('0.1.4')
  })

  // unstable channel

  it('it should work with unstable channel and current version to new version schema', () => {
    expect(
      nextExtensionVersion({
        prismaVersion: '2.0.0-alpha.1149',
        extensionVersion: '0.0.38',
      }),
    ).to.eq('0.0.1149')
  })

  it('it should work with unstable channel and extension only push', () => {
    expect(
      nextExtensionVersion({
        prismaVersion: '2.0.0-alpha.1149',
        extensionVersion: '0.0.1149',
      }),
    ).to.eq('0.0.1149.1')
  })

  it('it should work with unstable channel and new prisma version', () => {
    expect(
      nextExtensionVersion({
        prismaVersion: '2.0.0-alpha.1150',
        extensionVersion: '0.0.1149',
      }),
    ).to.eq('0.0.1150')
  })

  it('it should work with unstable channel and new prisma version after an extension only publish', () => {
    expect(
      nextExtensionVersion({
        prismaVersion: '2.0.0-alpha.1150',
        extensionVersion: '0.0.1149.1',
      }),
    ).to.eq('0.0.1150')
  })

  // after GA
  
  it('it should work with stable channel after the ga versioning scheme and current version to new version schema', () => {
    expect(
      nextExtensionVersion({
        prismaVersion: '2.0.1',
        extensionVersion: '0.0.3',
      }),
    ).to.eq('2.0.1')
  })

  it('it should work with stable channel after the ga versioning scheme and extension only push', () => {
    expect(
      nextExtensionVersion({
        prismaVersion: '2.0.1',
        extensionVersion: '0.0.3.1',
      }),
    ).to.eq('2.0.1')
  })

  it('it should work with stable channel after the ga versioning scheme and new prisma version', () => {
    expect(
      nextExtensionVersion({
        prismaVersion: '2.0.2',
        extensionVersion: '2.0.1',
      }),
    ).to.eq('2.0.2')
  })

  it('it should work with stable channel after the ga versioning scheme and new prisma version after an extension only publish', () => {
    expect(
      nextExtensionVersion({
        prismaVersion: '2.0.2',
        extensionVersion: '2.0.1.1',
      }),
    ).to.eq('2.0.2')
  })

  it('it should work with unstable channel after the ga versioning scheme and current version to new version schema', () => {
    expect(
      nextExtensionVersion({
        prismaVersion: '2.0.1-dev.1',
        extensionVersion: '0.0.1150', // = 2.0.0-alpha.1150
      }),
    ).to.eq('0.1.1')
  })

  it('it should work with unstable channel after the ga versioning scheme and extension only push', () => {
    expect(
      nextExtensionVersion({
        prismaVersion: '2.0.1-dev.1',
        extensionVersion: '0.1.1',
      }),
    ).to.eq('0.1.1.1')
  })

  it('it should work with unstable channel after the ga versioning scheme and new prisma version', () => {
    expect(
      nextExtensionVersion({
        prismaVersion: '2.0.1-dev.2',
        extensionVersion: '0.1.1',
      }),
    ).to.eq('0.1.2')
  })

  it('it should work with unstable channel after the ga versioning scheme and new prisma version after an extension only publish', () => {
    expect(
      nextExtensionVersion({
        prismaVersion: '2.0.1-dev.2',
        extensionVersion: '0.1.1.1',
      }),
    ).to.eq('0.1.2')
  })
})
