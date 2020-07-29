const { expect } = require('chai')

const { isMinorRelease } = require('./../is-minor-release.js')

describe('isMinorRelease', () => {

    it('Patch release is not a minor release', () => {
      expect(
        isMinorRelease({
          prismaVersion: '2.0.1',
        }),
      ).to.eq(false)
    })
  
    it('it should not work with a Prisma CLI dev version', () => {
      expect(() => {
        isMinorRelease({
          prismaVersion: '2.0.1-dev.1',
        })
      }).to.throw('')
    })
  
    it('it should work with a minor release', () => {
      expect(
        isMinorRelease({
          prismaVersion: '2.5.0',
        }),
      ).to.eq(true)
    })
  
    it('Patch release is not a minor release', () => {
      expect(
        isMinorRelease({
          prismaVersion: '2.5.8',
        }),
      ).to.eq(false)
    })
  })
  