import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { URI } from 'vscode-uri'
import { PrismaSchema } from '../lib/Schema'

const tempDirectories: string[] = []

afterEach(async () => {
  await Promise.all(tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('PrismaSchema', () => {
  test('excludes schema files from configured directories', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'prisma-language-server-'))
    tempDirectories.push(root)

    const activeDirectory = path.join(root, 'active')
    const excludedDirectory = path.join(root, 'excluded')

    await mkdir(activeDirectory)
    await mkdir(excludedDirectory)

    const activeSchemaPath = path.join(activeDirectory, 'schema.prisma')
    const excludedSchemaPath = path.join(excludedDirectory, 'schema.prisma')

    const activeContent = `
model Active {
  id Int @id
}
`

    const excludedContent = `
model Excluded {
  id Int @id
}
`

    await writeFile(activeSchemaPath, activeContent)
    await writeFile(excludedSchemaPath, excludedContent)

    const activeDocument = TextDocument.create(URI.file(activeSchemaPath).toString(), 'prisma', 1, activeContent)

    const excludedDocument = TextDocument.create(URI.file(excludedSchemaPath).toString(), 'prisma', 1, excludedContent)

    const schema = await PrismaSchema.load(
      {
        currentDocument: activeDocument,
        allDocuments: [activeDocument, excludedDocument],
      },
      root,
      {
        excludedSchemaDirectories: ['excluded'],
      },
    )

    expect(schema.documents).toHaveLength(1)
    expect(schema.documents[0].uri).toBe(activeDocument.uri)
    expect(schema.documents[0].content).toContain('model Active')
    expect(schema.documents[0].content).not.toContain('model Excluded')
  })
})
