import assert from 'node:assert'
import { Uri } from 'vscode'
import { createPrismaNextClientOptions } from '../../plugins/prisma-language-server/prismaNextClients'

suite('Prisma Next client options', () => {
  test('opts into completion-triggered parameter hints', () => {
    const options = createPrismaNextClientOptions({
      uri: Uri.file('/workspace'),
      name: 'workspace',
      index: 0,
    })

    assert.deepStrictEqual(options.initializationOptions, {
      completion: { supportsTriggerParameterHintsCommand: true },
    })
  })
})
