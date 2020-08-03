const { isMinorRelease } = require('./../is-minor-release.js')

describe('isMinorRelease', () => {

    it('Patch release is not a minor release', () => {
      expect(
        isMinorRelease({
          prismaVersion: '2.0.1',
        }),
      ).toEqual(false)
    })
  
    it('it should not work with a Prisma CLI dev version', () => {
      expect(() => {
        isMinorRelease({
          prismaVersion: '2.0.1-dev.1',
        })
      }).toThrow('')
    })
  
    it('it should work with a minor release', () => {
      expect(
        isMinorRelease({
          prismaVersion: '2.5.0',
        }),
      ).toEqual(true)
    })
  
    it('Patch release is not a minor release', () => {
      expect(
        isMinorRelease({
          prismaVersion: '2.5.8',
        }),
      ).toEqual(false)
    })
  })
  