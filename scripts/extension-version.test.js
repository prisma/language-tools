const { expect } = require('chai')

const { nextExtensionVersion } = require('./extension-version')

describe('next extension version', () => {

  it('it should work with stable channel after the ga versioning scheme and current version to new version schema', () => {
    expect(
      nextExtensionVersion({
        prismaVersion: '2.0.1',
        extensionVersion: '0.0.3',
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

  it('it should work with unstable channel after the ga versioning scheme and current version to new version schema', () => {
    expect(
      nextExtensionVersion({
        prismaVersion: '2.0.1-dev.1',
        extensionVersion: '0.0.1150', 
      }),
    ).to.eq('0.1.1')
  })

  it('it should throw with unstable channel after the ga versioning scheme and extension only push without the isExtensionOnlyCommit flag', () => {
    expect(() => {
      nextExtensionVersion({
        prismaVersion: '2.0.1-dev.1',
        extensionVersion: '0.1.1',
      })
    }).to.throw('')
  })

  it('it should work with unstable channel after the ga versioning scheme and extension only push', () => {
    expect(
      nextExtensionVersion({
        prismaVersion: '2.0.1-dev.1',
        extensionVersion: '0.1.1',
        isExtensionOnlyCommit: true,
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
})
