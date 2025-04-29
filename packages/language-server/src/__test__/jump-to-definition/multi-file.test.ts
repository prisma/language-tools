import { test, expect } from 'vitest'
import { handleDefinitionRequest } from '../../lib/MessageHandler'
import { getMultifileHelper } from '../MultifileHelper'

test('basic doc', async () => {
  const helper = await getMultifileHelper('user-posts')
  const post = helper.file('Post.prisma')

  const response = handleDefinitionRequest(helper.schema, post.textDocument, {
    textDocument: {
      uri: post.uri,
    },
    position: post.lineContaining('author   User').characterAfter('Us'),
  })

  expect(response).toMatchInlineSnapshot(`
    [
      {
        "targetRange": {
          "end": {
            "character": 1,
            "line": 10,
          },
          "start": {
            "character": 0,
            "line": 1,
          },
        },
        "targetSelectionRange": {
          "end": {
            "character": 10,
            "line": 1,
          },
          "start": {
            "character": 6,
            "line": 1,
          },
        },
        "targetUri": "file:///user-posts/User.prisma",
      },
    ]
  `)
})
