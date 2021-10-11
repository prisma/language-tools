import assert from 'assert'
import referentialActions from '../prisma-fmt/referentialActions'

suite('prisma-fmt subcommand: referential-actions', () => {
  test('SQLite', () => {
    const schema = `
        datasource db {
            provider = "sqlite"
            url      = env("DATABASE_URL")
        }
        
        generator client {
            provider        = "prisma-client-js"
            previewFeatures = ["referentialActions"]
        }`

    const actions = referentialActions(schema)

    assert.deepStrictEqual(actions, [
      'Cascade',
      'Restrict',
      'NoAction',
      'SetNull',
      'SetDefault',
    ])
  })

  test('PostgreSQL - minimal', () => {
    const schema = `
        datasource db {
            provider = "postgresql"
            url      = env("DATABASE_URL")
        }
        
        generator client {
            provider        = "prisma-client-js"
            previewFeatures = ["referentialActions"]
        }`

    const actions = referentialActions(schema)

    assert.deepStrictEqual(actions, [
      'Cascade',
      'Restrict',
      'NoAction',
      'SetNull',
      'SetDefault',
    ])
  })

  test('PostgreSQL - example', () => {
    const schema = `
        datasource db {
            provider = "postgresql"
            url      = env("DATABASE_URL")
        }
        
        generator client {
            provider        = "prisma-client-js"
            previewFeatures = ["referentialActions"]
        }
        
        model User {
            id    Int    @id @default(autoincrement())
            posts Post[]
        }
        
        model Post {
            id     Int          @id @default(autoincrement())
            title  String
            tags   TagOnPosts[]
            User   User?        @relation(fields: [userId], references: [id])
            userId Int?
        }
        
        model TagOnPosts {
            id     Int   @id @default(autoincrement())
            post   Post? @relation(fields: [postId], references: [id], onUpdate: Cascade, onDelete: Cascade)
            tag    Tag?  @relation(fields: [tagId], references: [id], onDelete: Cascade, onUpdate: Cascade)
            postId Int?
            tagId  Int?
        }
        
        model Tag {
            id    Int          @id @default(autoincrement())
            name  String       @unique
            posts TagOnPosts[]
        }`

    const actions = referentialActions(schema)

    assert.deepStrictEqual(actions, [
      'Cascade',
      'Restrict',
      'NoAction',
      'SetNull',
      'SetDefault',
    ])
  })

  test('MySQL', () => {
    const schema = `
        datasource db {
            provider = "mysql"
            url      = env("DATABASE_URL")
        }
        
        generator client {
            provider        = "prisma-client-js"
            previewFeatures = ["referentialActions"]
        }`

    const actions = referentialActions(schema)

    assert.deepStrictEqual(actions, [
      'Cascade',
      'Restrict',
      'NoAction',
      'SetNull',
      'SetDefault',
    ])
  })

  test('SQL Server', () => {
    const schema = `
        datasource db {
            provider = "sqlserver"
            url      = env("DATABASE_URL")
        }
        
        generator client {
            provider        = "prisma-client-js"
            previewFeatures = ["microsoftSqlServer", "referentialActions"]
        }`

    const actions = referentialActions(schema)

    assert.deepStrictEqual(actions, [
      'Cascade',
      'NoAction',
      'SetNull',
      'SetDefault',
    ])
  })

  test('no datasource should return empty []', () => {
    const schema = `
        generator client {
            provider        = "prisma-client-js"
            previewFeatures = ["referentialActions"]
        }`

    const actions = referentialActions(schema)

    assert.deepStrictEqual(actions, [])
  })

  test('invalid schema should return empty []', () => {
    const schema = `
        datasource db {
            provider = "sqlite"
            url      = env("DATABASE_URL")
        }

        generator client {
            provider        = "prisma-client-js"
            previewFeatures = ["referentialActions"]
        }
        
        model { sss } // invalid model
        `

    const actions = referentialActions(schema)

    assert.deepStrictEqual(actions, [])
  })
})
