const { patchBranchName } = require('./../patch/patch-branch.js')

describe('patchBranchName', () => {

  it('it should not work with a Prisma CLI dev version', () => {
    expect(() => {
      patchBranchName({
        version: '2.0.1-dev.1',
      })
    }).toThrow('')
  })

  it('it should work with a minor release', () => {
    expect(
      patchBranchName({
        version: '2.5.0',
      }),
    ).toEqual('2.5.x')
  })

  it('it should work with a patch release', () => {
    expect(
      patchBranchName({
        version: '2.5.8',
      }),
    ).toEqual('2.5.x')
  })
})
