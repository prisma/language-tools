import { describe, it, expect } from 'vitest'
import { applyPrismaVersion } from '../bump_prisma_dependencies.mjs'

const PACKAGE_JSON = {
  name: '@prisma/language-server',
  prisma: { enginesVersion: 'oldsha', cliVersion: '7.8.0' },
  dependencies: {
    '@prisma/config': '7.8.0',
    '@prisma/prisma-schema-wasm': '7.8.0-6.oldsha',
    '@prisma/schema-files-loader': '7.8.0',
    'vscode-languageserver': '9.0.1',
  },
}

describe('applyPrismaVersion', () => {
  const bumped = applyPrismaVersion({
    packageJson: PACKAGE_JSON,
    prismaVersion: '7.9.0',
    engineVersion: '7.9.0-23.9b816b3aa13cc270074f172f30d6eda8a8ce867d',
  })

  it('pins every Prisma dependency to the new CLI version', () => {
    expect(bumped.dependencies['@prisma/config']).toEqual('7.9.0')
    expect(bumped.dependencies['@prisma/schema-files-loader']).toEqual('7.9.0')
    expect(bumped.dependencies['@prisma/prisma-schema-wasm']).toEqual(
      '7.9.0-23.9b816b3aa13cc270074f172f30d6eda8a8ce867d',
    )
  })

  it('records the CLI version and the engine sha', () => {
    expect(bumped.prisma.cliVersion).toEqual('7.9.0')
    expect(bumped.prisma.enginesVersion).toEqual('9b816b3aa13cc270074f172f30d6eda8a8ce867d')
  })

  it('leaves unrelated dependencies alone', () => {
    expect(bumped.dependencies['vscode-languageserver']).toEqual('9.0.1')
  })

  it('does not mutate the input', () => {
    expect(PACKAGE_JSON.prisma.cliVersion).toEqual('7.8.0')
  })

  it('throws when the engine version carries no sha', () => {
    expect(() =>
      applyPrismaVersion({ packageJson: PACKAGE_JSON, prismaVersion: '7.9.0', engineVersion: '7.9.0' }),
    ).toThrow()
  })
})
