import { test, expect } from 'vitest'
import { handleCompletionRequest } from '../../lib/MessageHandler'
import { getMultifileHelper } from './MultifileHelper'

test('type name completion', async () => {
  const helper = await getMultifileHelper('complete-field')
  const post = helper.file('Post.prisma')

  const response = handleCompletionRequest(helper.schema, post.textDocument, {
    textDocument: {
      uri: post.uri,
    },
    position: post.lineContaining('author Us').characterAfter('Us'),
  })

  const userItem = response?.items.find((item) => item.label === 'User')
  expect(userItem).not.toBeUndefined()
})
