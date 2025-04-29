import { test, expect } from 'vitest'
import { handleCodeActions, handleDiagnosticsRequest } from '../../lib/MessageHandler'
import { getMultifileHelper } from '../MultifileHelper'
test('basic doc', async () => {
  const helper = await getMultifileHelper('quick-fix')
  const profile = helper.file('Profile.prisma')
  const diagnostics = handleDiagnosticsRequest(helper.schema).get(profile.uri)
  const response = handleCodeActions(helper.schema, profile.textDocument, {
    textDocument: {
      uri: profile.uri,
    },
    range: {
      start: profile.lineContaining('user   User').characterAfter('us'),
      end: profile.lineContaining('user   User').characterAfter('user'),
    },
    context: {
      diagnostics,
    },
  })
  const changes = response[0]?.edit?.changes
  const updated = helper.applyChanges(changes)
  expect(updated).toMatchInlineSnapshot(`
    {
      "file:///quick-fix/Profile.prisma": "model Profile {
        id     String @id @default(uuid())
        userId String @unique
        user   User   @relation(fields: [userId], references: [id])
    }
    ",
    }
  `)
})
