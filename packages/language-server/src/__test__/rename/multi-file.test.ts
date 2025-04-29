import { test, expect } from 'vitest'
import { handleRenameRequest } from '../../lib/MessageHandler'
import { getMultifileHelper } from '../MultifileHelper'

test('rename model', async () => {
  const helper = await getMultifileHelper('user-posts')
  const user = helper.file('User.prisma')

  const response = handleRenameRequest(helper.schema, user.textDocument, {
    textDocument: {
      uri: user.uri,
    },
    position: user.lineContaining('model User').characterAfter('Us'),
    newName: 'Account',
  })

  expect(response).toMatchInlineSnapshot(`
    {
      "changes": {
        "file:///user-posts/Post.prisma": [
          {
            "newText": "Account",
            "range": {
              "end": {
                "character": 17,
                "line": 6,
              },
              "start": {
                "character": 13,
                "line": 6,
              },
            },
          },
        ],
        "file:///user-posts/User.prisma": [
          {
            "newText": "Account",
            "range": {
              "end": {
                "character": 10,
                "line": 1,
              },
              "start": {
                "character": 6,
                "line": 1,
              },
            },
          },
          {
            "newText": "	@@map("User")
    }",
            "range": {
              "end": {
                "character": 1,
                "line": 10,
              },
              "start": {
                "character": 0,
                "line": 10,
              },
            },
          },
        ],
      },
    }
  `)

  expect(helper.applyChanges(response?.changes)).toMatchInlineSnapshot(`
    {
      "file:///user-posts/Post.prisma": "/// This is a blog post
    model Post {
        id       String @id @default(uuid()) @map("_id")
        title    String
        content  String
        authorId String
        author   Account   @relation(fields: [authorId], references: [id])
    }
    ",
      "file:///user-posts/User.prisma": "/// This is the user of the platform
    model Account {
        id    String @id @default(uuid()) @map("_id")
        name  String
        email String
        posts Post[]

        address Address

        favouriteAnimal FavouriteAnimal
    	@@map("User")
    }
    ",
    }
  `)
})

test('rename field - map exists', async () => {
  const helper = await getMultifileHelper('user-posts')
  const user = helper.file('User.prisma')

  const response = handleRenameRequest(helper.schema, user.textDocument, {
    textDocument: {
      uri: user.uri,
    },
    position: user.lineContaining('id').characterAfter('i'),
    newName: 'primaryKey',
  })

  expect(response).toMatchInlineSnapshot(`
    {
      "changes": {
        "file:///user-posts/Post.prisma": [
          {
            "newText": "primaryKey",
            "range": {
              "end": {
                "character": 65,
                "line": 6,
              },
              "start": {
                "character": 63,
                "line": 6,
              },
            },
          },
        ],
        "file:///user-posts/User.prisma": [
          {
            "newText": "primaryKey",
            "range": {
              "end": {
                "character": 6,
                "line": 2,
              },
              "start": {
                "character": 4,
                "line": 2,
              },
            },
          },
        ],
      },
    }
  `)

  expect(helper.applyChanges(response?.changes)).toMatchInlineSnapshot(`
    {
      "file:///user-posts/Post.prisma": "/// This is a blog post
    model Post {
        id       String @id @default(uuid()) @map("_id")
        title    String
        content  String
        authorId String
        author   User   @relation(fields: [authorId], references: [primaryKey])
    }
    ",
      "file:///user-posts/User.prisma": "/// This is the user of the platform
    model User {
        primaryKey    String @id @default(uuid()) @map("_id")
        name  String
        email String
        posts Post[]

        address Address

        favouriteAnimal FavouriteAnimal
    }
    ",
    }
  `)
})

test('rename field - map does not exist', async () => {
  const helper = await getMultifileHelper('user-posts')
  const user = helper.file('User.prisma')

  const response = handleRenameRequest(helper.schema, user.textDocument, {
    textDocument: {
      uri: user.uri,
    },
    position: user.lineContaining('name  String').characterAfter('na'),
    newName: 'fullName',
  })

  expect(response).toMatchInlineSnapshot(`
    {
      "changes": {
        "file:///user-posts/User.prisma": [
          {
            "newText": "fullName",
            "range": {
              "end": {
                "character": 8,
                "line": 3,
              },
              "start": {
                "character": 4,
                "line": 3,
              },
            },
          },
          {
            "newText": " @map("name")",
            "range": {
              "end": {
                "character": 16,
                "line": 3,
              },
              "start": {
                "character": 16,
                "line": 3,
              },
            },
          },
        ],
      },
    }
  `)

  expect(helper.applyChanges(response?.changes)).toMatchInlineSnapshot(`
    {
      "file:///user-posts/User.prisma": "/// This is the user of the platform
    model User {
        id    String @id @default(uuid()) @map("_id")
        fullName  String @map("name")
        email String
        posts Post[]

        address Address

        favouriteAnimal FavouriteAnimal
    }
    ",
    }
  `)
})
