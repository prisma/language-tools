import { test, expect, describe } from 'vitest'
import { handleHoverRequest } from '../lib/MessageHandler'
import { getMultifileHelper } from './MultifileHelper'

describe('hover', () => {
  test('model doc from field', async () => {
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

  test('enum doc from field', async () => {
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

  test('composite doc from field', async () => {
    const helper = await getMultifileHelper('user-posts')
    const user = helper.file('User.prisma')

    const response = handleHoverRequest(helper.schema, user.textDocument, {
      textDocument: {
        uri: user.uri,
      },
      position: user.lineContaining('address Address').characterAfter('Addr'),
    })

    expect(response).toMatchInlineSnapshot(`
      {
        "contents": {
          "kind": "markdown",
          "value": "\`\`\`prisma
      type Address {}
      \`\`\`
      ___
      Petrichor V",
        },
      }
    `)
  })

  test('doc from block name', async () => {
    const helper = await getMultifileHelper('user-posts')
    const user = helper.file('animal.prisma')

    const response = handleHoverRequest(helper.schema, user.textDocument, {
      textDocument: {
        uri: user.uri,
      },
      position: user.lineContaining('enum FavouriteAnimal {').characterAfter('Fav'),
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

  test('doc from field name', async () => {
    const helper = await getMultifileHelper('user-posts')
    const user = helper.file('address.prisma')

    const response = handleHoverRequest(helper.schema, user.textDocument, {
      textDocument: {
        uri: user.uri,
      },
      position: user.lineContaining('country String').characterAfter('cou'),
    })

    expect(response).toMatchInlineSnapshot(`
      {
        "contents": {
          "kind": "markdown",
          "value": "\`\`\`prisma
      country
      \`\`\`
      ___
      ISO 3166-2 standard",
        },
      }
    `)
  })
})
