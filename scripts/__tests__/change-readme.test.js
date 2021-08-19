const { getNewReadMeContent } = require('./../change_readme.js')

describe('changeReadme', () => {
  it('it should with an insider release', () => {
    expect(
      getNewReadMeContent({
        releaseChannel: 'dev',
        npmVersion: '2.5.0-dev.4',
      }),
    ).toMatchSnapshot()
  })

  it('it should work with a patch release', () => {
    expect(
      getNewReadMeContent({
        releaseChannel: 'patch-dev',
        npmVersion: '2.5.1-dev.1',
      }),
    ).toMatchSnapshot()
  })

  it('it should work with a stable release', () => {
    expect(
      getNewReadMeContent({
        releaseChannel: 'latest',
        npmVersion: '2.4.0',
      }),
    ).toMatchSnapshot()
  })
})
