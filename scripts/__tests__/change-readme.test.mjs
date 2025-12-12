import { describe, it, expect } from 'vitest'
import { getNewReadMeContent } from '../change_readme.mjs'

describe('changeReadme', () => {

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
