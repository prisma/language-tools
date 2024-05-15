import { test, expect } from 'vitest'
import { handleCodeActions, handleDiagnosticsRequest } from '../../lib/MessageHandler'
import { getMultifileHelper } from './MultifileHelper'

test('basic doc', async () => {
  const helper = await getMultifileHelper('quick-fix')
  const profile = helper.file('Profile.prisma')
  const diagnostics = handleDiagnosticsRequest(helper.schema).get(profile.uri)

  const response = handleCodeActions(helper.schema, profile.textDocument, {
    textDocument: {
      uri: profile.uri,
    },
    range: {
      start: profile.lineContaining('user User').characterAfter('us'),
      end: profile.lineContaining('user User').characterAfter('user'),
    },
    context: {
      diagnostics,
    },
  })
  expect(response).toMatchInlineSnapshot(`
    [
      {
        "diagnostics": [
          {
            "message": "Error parsing attribute "@relation": A one-to-one relation must use unique fields on the defining side. Either add an \`@unique\` attribute to the field \`userId\`, or change the relation to one-to-many.",
            "range": {
              "end": {
                "character": 0,
                "line": 4,
              },
              "start": {
                "character": 4,
                "line": 3,
              },
            },
            "severity": 1,
            "source": "Prisma",
          },
        ],
        "edit": {
          "changes": {
            "file:///multifile/quick-fix/Profile.prisma": [
              {
                "newText": " @unique",
                "range": {
                  "end": {
                    "character": 17,
                    "line": 2,
                  },
                  "start": {
                    "character": 17,
                    "line": 2,
                  },
                },
              },
            ],
          },
        },
        "kind": "quickfix",
        "title": "Make referencing fields unique",
      },
    ]
  `)

  const changes = response[0]?.edit?.changes
  const updated = helper.applyChanges(changes)
  expect(updated).toMatchInlineSnapshot(`
    {
      "file:///multifile/quick-fix/Profile.prisma": "model Profile {
        id    String @id @default(uuid())
        userId String @unique
        user User @relation(fields: [userId], references: [id])
    }
    ",
    }
  `)
})
