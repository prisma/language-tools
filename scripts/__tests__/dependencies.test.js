var semver = require('semver')

describe('version incompatibilities', () => {
  it('@types/vscode should be less than or equal to engine.vscode version', () => {
    const packageJson = require('../../packages/vscode/package.json')
    const vscodeTypes = packageJson.devDependencies['@types/vscode']
    const vscodeEngine = packageJson.engines.vscode
    expect(
      semver.ltr(vscodeTypes, vscodeEngine) ||
        semver.eq(vscodeTypes, vscodeEngine.substring(1)),
    ).toBeTruthy()
  })
})
