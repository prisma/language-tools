describe('changeReadme', () => {
  let getNewReadMeContent

  beforeAll(async () => {
    const module = await import('./../change_readme.mjs')
    getNewReadMeContent = module.getNewReadMeContent
  })

  it('it should with an insider release', () => {
    expect(
      getNewReadMeContent({
        releaseChannel: 'insider',
        cliVersion: '2.5.0-dev.4',
      }),
    ).toMatchSnapshot()
  })

  it('it should work with a stable release', () => {
    expect(
      getNewReadMeContent({
        releaseChannel: 'stable',
        cliVersion: '2.4.0',
      }),
    ).toMatchSnapshot()
  })
})
