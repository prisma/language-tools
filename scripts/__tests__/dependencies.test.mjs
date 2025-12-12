import { describe, it, expect } from 'vitest'
import semver from 'semver'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const require = createRequire(import.meta.url)

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
