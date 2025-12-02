const { getNewReadMeContent } = require('./../change_readme.js')

describe('changeReadme', () => {
  it('it should with an insider release', () => {
    expect(
      getNewReadMeContent({
        trigger: 'insider-release',
        cliVersion: '2.5.0-dev.4',
      }),
    ).toMatchSnapshot()
  })

  it('it should work with a stable release', () => {
    expect(
      getNewReadMeContent({
        trigger: 'stable-release',
        cliVersion: '2.4.0',
      }),
    ).toMatchSnapshot()
  })
})
