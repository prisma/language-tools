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

test('external tables and enums', async () => {
  const helper = await getMultifileHelper('external-config')

  const response = handleDiagnosticsRequest(helper.schema)

  expect(response).toMatchInlineSnapshot(`
    DiagnosticMap {
      "_map": Map {
        "file:///external-config/config.prisma" => [],
        "file:///external-config/schema.prisma" => [
          {
            "message": "The model "Post" is marked as external in the Prisma config file.",
            "range": {
              "end": {
                "character": 1,
                "line": 18,
              },
              "start": {
                "character": 0,
                "line": 9,
              },
            },
            "severity": 4,
            "tags": [
              1,
            ],
          },
          {
            "message": "The model "Like" is marked as external in the Prisma config file.",
            "range": {
              "end": {
                "character": 1,
                "line": 28,
              },
              "start": {
                "character": 0,
                "line": 20,
              },
            },
            "severity": 4,
            "tags": [
              1,
            ],
          },
          {
            "message": "The enum "Role" is marked as external in the Prisma config file.",
            "range": {
              "end": {
                "character": 1,
                "line": 35,
              },
              "start": {
                "character": 0,
                "line": 30,
              },
            },
            "severity": 4,
            "tags": [
              1,
            ],
          },
        ],
      },
    }
  `)
})

test('config with an unresolved import doesn not crash the language server', async () => {
  const helper = await getMultifileHelper('config-with-broken-import')

  const response = handleDiagnosticsRequest(helper.schema)
  expect(response).toMatchInlineSnapshot(`
      DiagnosticMap {
        "_map": Map {
          "file:///config-with-broken-import/schema.prisma" => [],
        },
      }
    `)
})

test('config with an unresolved env var doesn not crash the language server', async () => {
  const helper = await getMultifileHelper('config-with-unresolved-env-var')

  const response = handleDiagnosticsRequest(helper.schema)
  expect(response).toMatchInlineSnapshot(`
      DiagnosticMap {
        "_map": Map {
          "file:///config-with-unresolved-env-var/schema.prisma" => [],
        },
      }
    `)
})
