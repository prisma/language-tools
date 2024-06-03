import { test, expect } from 'vitest'
import { handleHoverRequest } from '../../lib/MessageHandler'
import { getMultifileHelper } from '../MultifileHelper'

test('basic doc', async () => {
  const helper = await getMultifileHelper('user-posts')
  const user = helper.file('User.prisma')

  const response = handleHoverRequest(helper.schema, user.textDocument, {
    textDocument: {
      uri: user.uri,
    },
    position: user.lineContaining('posts Post[]').characterAfter('Po'),
  })

  expect(response).toMatchInlineSnapshot(`
    {
      "contents": "This is a blog post",
    }
  `)
})
