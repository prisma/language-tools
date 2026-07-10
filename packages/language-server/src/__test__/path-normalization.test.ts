import { describe, it, expect } from 'vitest'
import { URI } from 'vscode-uri'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { PrismaSchema } from '../lib/Schema'

describe('Path normalization for Windows compatibility (#1985)', () => {
  it('old code: fsPath is platform-dependent', () => {
    const docUri = 'file:///C:/Users/juan/prisma/schema/user.prisma'

    const storedPath = URI.parse(docUri).fsPath

    if (process.platform === 'win32') {
      expect(storedPath).toContain('\\')
    } else {
      expect(storedPath).not.toContain('\\')
    }
  })

  it('new code: toString() never produces backslashes', () => {
    const docUri = 'file:///C:/Users/juan/prisma/schema/user.prisma'

    const storedPath = URI.parse(docUri).toString()

    expect(storedPath).not.toContain('\\')
    expect(storedPath).toMatch(/^file:\/\//)
  })

  it('URI.file() normalizes Windows backslash paths to forward-slash URIs', () => {
    const windowsPath = 'C:\\Users\\juan\\prisma\\schema\\user.prisma'

    const normalized = URI.file(windowsPath).toString()

    expect(normalized).not.toContain('\\')
    expect(normalized).toMatch(/^file:\/\//)
  })

  it('PrismaSchema preserves URI format when loading multi-file schema', async () => {
    const baseUri = 'file:///C:/Users/juan/prisma/schema'

    const userDoc = TextDocument.create(
      `${baseUri}/User.prisma`,
      'prisma',
      1,
      `model User {
  id    String @id
  name  String
  posts Post[]
}`,
    )

    const postDoc = TextDocument.create(
      `${baseUri}/Post.prisma`,
      'prisma',
      1,
      `model Post {
  id       String @id
  title    String
  authorId String
  author   User   @relation(fields: [authorId], references: [id])
}`,
    )

    const schema = await PrismaSchema.load([userDoc, postDoc])

    expect(schema.documents).toHaveLength(2)

    for (const doc of schema.documents) {
      expect(doc.uri).not.toContain('\\')
      expect(doc.uri).toMatch(/^file:\/\//)
    }

    expect(schema.findDocByUri(userDoc.uri)).toBeDefined()
    expect(schema.findDocByUri(postDoc.uri)).toBeDefined()
  })
})
