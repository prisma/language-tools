const { nextExtensionVersion } = require('./../extension-version')

describe('next extension version', () => {

  // normal insider release
  it('it should work with an insider release triggered by Prisma CLI', () => {
    expect(
      nextExtensionVersion({
        prismaVersion: '2.5.0-dev.2',
        extensionVersion: '5.0.1',
      }),
    ).toEqual('5.0.2')
  })

  it('it should work with an insider release triggered by Prisma CLI after an extension only release', () => {
    expect(
      nextExtensionVersion({
        prismaVersion: '2.5.0-dev.2',
        extensionVersion: '5.0.2',
      }),
    ).toEqual('5.0.3')
  })

  // patches
  it('it should work with a first patch release after Prisma CLI stable on Insider', () => {
    expect(
      nextExtensionVersion({
        prismaVersion: '2.3.0',
        extensionVersion: '2.2.1',
        patchRelease: true,
      }),
    ).toEqual('3.1.1')
  })

  it('it should work with a second patch release after Prisma CLI stable on Insider', () => {
    expect(
      nextExtensionVersion({
        prismaVersion: '2.3.1',
        extensionVersion: '3.1.1',
        patchRelease: true,
      }),
    ).toEqual('3.1.2')
  })

  it ('it should work with a first Prisma CLI patch on stable', () => {
    expect(
      nextExtensionVersion({
        prismaVersion: '2.5.1',
        extensionVersion: '2.5.0',
      })
    ).toEqual('2.5.1')
  })

  it ('it should work with a Prisma CLI patch on stable', () => {
    expect(
      nextExtensionVersion({
        prismaVersion: '2.5.1',
        extensionVersion: '2.5.1',
      })
    ).toEqual('2.5.2')
  })

  // first extension release after Prisma CLI minor update

  it('it should work with the first extension release after a minor Prisma CLI update', () => {
    expect(
      nextExtensionVersion({
        prismaVersion: '2.5.1-dev.2',
        extensionVersion: '5.1.3', 
        patchRelease: false,
        prismaStableVersion: '2.5.0',
        stableMinorRelease: true
      }),
    ).toEqual('6.0.1')
  })

  it('it should not work with the first extension release after a minor Prisma CLI update and a dev version for the Prisma stable verison', () => {
    expect(() => {
      nextExtensionVersion({
        prismaVersion: '2.5.1-dev.2',
        extensionVersion: '5.1.3', 
        patchRelease: false,
        prismaStableVersion: '2.5.1-dev.0',
        stableMinorRelease: true
      })
    }).toThrow('')
  })

})
