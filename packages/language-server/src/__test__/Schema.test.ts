import { loadRelatedSchemaFiles } from '@prisma/schema-files-loader'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { URI } from 'vscode-uri'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { PrismaSchema } from '../lib/Schema'

vi.mock('@prisma/config', () => ({
  loadConfigFromFile: vi.fn().mockResolvedValue({ config: undefined }),
}))

vi.mock('@prisma/schema-files-loader', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@prisma/schema-files-loader')>()),
  loadRelatedSchemaFiles: vi.fn(),
}))

describe('PrismaSchema.load', () => {
  beforeEach(() => {
    vi.mocked(loadRelatedSchemaFiles).mockReset()
  })

  test('preserves the client URI for an open document', async () => {
    const clientUri = 'file:///C:/workspace/schema.prisma'
    const filePath = URI.parse(clientUri).fsPath
    const document = TextDocument.create(clientUri, 'prisma', 7, 'model User {\n  id Int @id\n}')

    vi.mocked(loadRelatedSchemaFiles).mockResolvedValue([[filePath, document.getText()]])

    const schema = await PrismaSchema.load({ currentDocument: document, allDocuments: [document] })

    expect(schema.documents).toHaveLength(1)
    expect(schema.documents[0].uri).toBe(clientUri)
  })

  test('creates a file URI for a related document that is not open', async () => {
    const clientUri = 'file:///C:/workspace/schema.prisma'
    const currentDocument = TextDocument.create(clientUri, 'prisma', 1, '')
    const relatedFilePath = URI.parse('file:///C:/workspace/related.prisma').fsPath
    const relatedContent = 'model Related {\n  id Int @id\n}'

    vi.mocked(loadRelatedSchemaFiles).mockResolvedValue([
      [URI.parse(clientUri).fsPath, currentDocument.getText()],
      [relatedFilePath, relatedContent],
    ])

    const schema = await PrismaSchema.load({ currentDocument, allDocuments: [currentDocument] })

    expect(schema.documents).toHaveLength(2)
    expect(schema.documents[1].uri).toBe(URI.file(relatedFilePath).toString())
    expect(schema.documents[1].content).toBe(relatedContent)
  })
})
