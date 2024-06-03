import { test, expect } from 'vitest'
import { handleDiagnosticsRequest } from '../../lib/MessageHandler'
import { getMultifileHelper } from '../MultifileHelper'

test('invalid doc', async () => {
  const helper = await getMultifileHelper('linting')

  const response = handleDiagnosticsRequest(helper.schema)

  expect(response).toMatchInlineSnapshot(`
    DiagnosticMap {
      "_map": Map {
        "file:///linting/Post.prisma" => [
          {
            "message": "Type "Like" is neither a built-in type, nor refers to another model, composite type, or enum.",
            "range": {
              "end": {
                "character": 17,
                "line": 7,
              },
              "start": {
                "character": 13,
                "line": 7,
              },
            },
            "severity": 1,
            "source": "Prisma",
          },
        ],
        "file:///linting/User.prisma" => [],
        "file:///linting/config.prisma" => [],
      },
    }
  `)
})
