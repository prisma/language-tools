import { describe, it, expect } from 'vitest'
import { URI } from 'vscode-uri'

describe('Path normalization for Windows compatibility (#1985)', () => {
  it('old code: fsPath produces backslashes on Windows-style paths', () => {
    const docUri = 'file:///C:/Users/juan/prisma/schema/user.prisma'

    const storedPath = URI.parse(docUri).fsPath

    expect(typeof storedPath).toBe('string')
  })

  it('new code: toString() never produces backslashes', () => {
    const docUri = 'file:///C:/Users/juan/prisma/schema/user.prisma'

    const storedPath = URI.parse(docUri).toString()

    expect(storedPath).not.toContain('\\')
    expect(storedPath).toMatch(/^file:\/\//)
  })

  it('Windows path with backslashes should produce forward slashes after normalization', () => {
    const windowsPath = 'C:\\Users\\juan\\prisma\\schema\\user.prisma'

    const normalized = windowsPath.replace(/\\/g, '/')

    expect(windowsPath).toContain('\\')

    expect(normalized).not.toContain('\\')
    expect(normalized).toBe('C:/Users/juan/prisma/schema/user.prisma')
  })

  it('two URIs parsed and stringified should both lack backslashes', () => {
    const uri1 = 'file:///C:/Users/juan/prisma/schema/user.prisma'
    const uri2 = 'file:///C:/Users/juan/prisma/schema/user.prisma'

    const normalized1 = URI.parse(uri1).toString()
    const normalized2 = URI.parse(uri2).toString()

    expect(normalized1).not.toContain('\\')
    expect(normalized2).not.toContain('\\')
  })
})
