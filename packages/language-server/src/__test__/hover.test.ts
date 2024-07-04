import { test, expect } from 'vitest'
import { handleHoverRequest } from '../lib/MessageHandler'
import { getMultifileHelper } from './MultifileHelper'
import { describe } from 'node:test'

describe('hover', () => {
  test('model doc', async () => {
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
        "contents": {
          "kind": "markdown",
          "value": "\`\`\`prisma
      model Post {
      	...
      	author User @relation(name: "PostToUser", fields: [authorId], references: [id])
      }
      \`\`\`
      ___
      one-to-many 
      ___
      This is a blog post",
        },
      }
    `)
  })

  test('enum doc', async () => {
    const helper = await getMultifileHelper('user-posts')
    const user = helper.file('User.prisma')

    const response = handleHoverRequest(helper.schema, user.textDocument, {
      textDocument: {
        uri: user.uri,
      },
      position: user.lineContaining('favouriteAnimal FavouriteAnimal').characterAfter('Favo'),
    })

    expect(response).toMatchInlineSnapshot(`
      {
        "contents": {
          "kind": "markdown",
          "value": "\`\`\`prisma
      enum FavouriteAnimal {}
      \`\`\`
      ___
      My favourite is the red panda, could you tell?",
        },
      }
    `)
  })
})
