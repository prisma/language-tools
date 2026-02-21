import { test, expect, describe } from 'vitest'
import { PrismaSchema, SchemaDocument } from '../lib/Schema'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { URI } from 'vscode-uri'
import path from 'path'
import { loadSchemaFiles } from '@prisma/schema-files-loader'

const multifileFixturesDir = path.join(__dirname, '__fixtures__/multi-file')

describe('PrismaSchema.load with schemaPath option', () => {
  test('loads multi-file schema using schemaPath option', async () => {
    const schemaPath = path.join(multifileFixturesDir, 'user-posts')

    // Create a single document (simulating opening one file in the editor)
    const singleFilePath = path.join(schemaPath, 'Post.prisma')
    const files = await loadSchemaFiles(schemaPath)
    const postFile = files.find(([filePath]) => filePath.endsWith('Post.prisma'))

    if (!postFile) {
      throw new Error('Post.prisma not found in fixtures')
    }

    const currentDocument = TextDocument.create(URI.file(singleFilePath).toString(), 'prisma', 1, postFile[1])

    // Load schema with schemaPath option (simulating VS Code setting)
    const schema = await PrismaSchema.load({ currentDocument, allDocuments: [currentDocument] }, { schemaPath })

    // Should have loaded all files from the directory, not just the current document
    expect(schema.documents.length).toBeGreaterThan(1)

    // Should include User.prisma, Post.prisma, config.prisma, etc.
    const fileNames = schema.documents.map((doc) => {
      const uri = URI.parse(doc.uri)
      return path.basename(uri.fsPath)
    })

    expect(fileNames).toContain('User.prisma')
    expect(fileNames).toContain('Post.prisma')
    expect(fileNames).toContain('config.prisma')
  })

  test('falls back to current document path when schemaPath is not provided', async () => {
    const schemaPath = path.join(multifileFixturesDir, 'user-posts')
    const files = await loadSchemaFiles(schemaPath)
    const postFile = files.find(([filePath]) => filePath.endsWith('Post.prisma'))

    if (!postFile) {
      throw new Error('Post.prisma not found in fixtures')
    }

    const singleFilePath = path.join(schemaPath, 'Post.prisma')
    const currentDocument = TextDocument.create(URI.file(singleFilePath).toString(), 'prisma', 1, postFile[1])

    // Load schema WITHOUT schemaPath option
    const schema = await PrismaSchema.load(
      { currentDocument, allDocuments: [currentDocument] },
      {}, // No schemaPath provided
    )

    // Should still load all related files (via loadRelatedSchemaFiles)
    expect(schema.documents.length).toBeGreaterThan(1)
  })

  test('supports backward compatibility with string configRoot parameter', async () => {
    const schemaPath = path.join(multifileFixturesDir, 'user-posts')
    const files = await loadSchemaFiles(schemaPath)
    const postFile = files.find(([filePath]) => filePath.endsWith('Post.prisma'))

    if (!postFile) {
      throw new Error('Post.prisma not found in fixtures')
    }

    const singleFilePath = path.join(schemaPath, 'Post.prisma')
    const currentDocument = TextDocument.create(URI.file(singleFilePath).toString(), 'prisma', 1, postFile[1])

    // Load schema with old signature (string configRoot)
    const schema = await PrismaSchema.load(
      { currentDocument, allDocuments: [currentDocument] },
      schemaPath, // Old signature: string instead of options object
    )

    expect(schema.documents.length).toBeGreaterThan(1)
  })

  test('schemaPath takes priority over prisma.config.ts', async () => {
    const externalConfigDir = path.join(multifileFixturesDir, 'external-config')
    const schemaPath = path.join(externalConfigDir, 'schema.prisma')

    const files = await loadSchemaFiles(externalConfigDir)
    const schemaFile = files.find(([filePath]) => filePath.endsWith('schema.prisma'))

    if (!schemaFile) {
      throw new Error('schema.prisma not found in fixtures')
    }

    const currentDocument = TextDocument.create(URI.file(schemaPath).toString(), 'prisma', 1, schemaFile[1])

    // Load with explicit schemaPath
    const schema = await PrismaSchema.load({ currentDocument, allDocuments: [currentDocument] }, { schemaPath })

    // Should load based on schemaPath, not config
    expect(schema.documents.length).toBeGreaterThan(0)
    const fileNames = schema.documents.map((doc) => path.basename(URI.parse(doc.uri).fsPath))
    expect(fileNames).toContain('schema.prisma')
  })

  test('loads schema from SchemaDocument array directly', async () => {
    const schemaPath = path.join(multifileFixturesDir, 'user-posts')
    const files = await loadSchemaFiles(schemaPath)

    const schemaDocs = files.map(([filePath, content]) => {
      const uri = URI.file(filePath).toString()
      const doc = TextDocument.create(uri, 'prisma', 1, content)
      return new SchemaDocument(doc)
    })

    // Load with array input (used in tests)
    const schema = await PrismaSchema.load(schemaDocs, { configRoot: schemaPath })

    expect(schema.documents.length).toBe(schemaDocs.length)
  })
})
