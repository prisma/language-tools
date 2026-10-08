import { describe, expect, test } from 'vitest'
import { findToken, hasScope, tokenizeSchema } from './tokenize'

describe('single-quoted strings', () => {
  test('a string literal in @default has string scopes', async () => {
    const lines = await tokenizeSchema(`model User {
  id String @default('x')
}`)
    const fieldLine = lines[1]
    const open = findToken(fieldLine, "'")
    const body = findToken(fieldLine, 'x')
    expect(open).toBeDefined()
    expect(hasScope(open!, 'string.quoted.single.start.prisma')).toBe(true)
    expect(body).toBeDefined()
    expect(hasScope(body!, 'string.quoted.single.prisma')).toBe(true)
  })

  test('a backslash escapes the next character', async () => {
    const lines = await tokenizeSchema(`model User {
  name String @default('a\\'b')
}`)
    const fieldLine = lines[1]
    const escape = findToken(fieldLine, "\\'")
    expect(escape).toBeDefined()
    expect(hasScope(escape!, 'constant.character.escape.prisma')).toBe(true)
  })
})

describe('bare backtick strings', () => {
  test('a single-line backtick string tokenises its two escapes', async () => {
    const lines = await tokenizeSchema(`model User {
  value String @default(\`a\\\`b\\\\c\`)
}`)
    const fieldLine = lines[1]
    const open = findToken(fieldLine, '`')
    const backtickEscape = findToken(fieldLine, '\\`')
    const backslashEscape = findToken(fieldLine, '\\\\')

    expect(open).toBeDefined()
    expect(hasScope(open!, 'string.quoted.backtick.start.prisma')).toBe(true)

    for (const escape of [backtickEscape, backslashEscape]) {
      expect(escape).toBeDefined()
      expect(hasScope(escape!, 'constant.character.escape.prisma')).toBe(true)
      expect(hasScope(escape!, 'string.quoted.backtick.prisma')).toBe(true)
    }
  })

  test('a backslash-dollar is not an escape, and is kept as written', async () => {
    const lines = await tokenizeSchema(`model User {
  value String @default(\`a\\\$b\`)
}`)
    const fieldLine = lines[1]
    const dollarToken = findToken(fieldLine, '\\$')
    expect(dollarToken).toBeUndefined()

    const content = findToken(fieldLine, 'a\\$b')
    expect(content).toBeDefined()
    expect(hasScope(content!, 'string.quoted.backtick.prisma')).toBe(true)
  })

  test('a multi-line backtick string stays a string across lines', async () => {
    const lines = await tokenizeSchema(`model User {
  id String @default(\`abc\\\`de\\\\f
  ghi\\\\jkl\`)
  name2 String
}`)
    const openingLine = lines[1]
    const closingLine = lines[2]
    const followingLine = lines[3]

    const content = findToken(openingLine, 'abc')
    expect(content).toBeDefined()
    expect(hasScope(content!, 'string.quoted.backtick.prisma')).toBe(true)

    const closingBacktick = findToken(closingLine, '`')
    expect(closingBacktick).toBeDefined()
    expect(hasScope(closingBacktick!, 'string.quoted.backtick.end.prisma')).toBe(true)

    const closingContent = findToken(closingLine, 'jkl')
    expect(closingContent).toBeDefined()
    expect(hasScope(closingContent!, 'string.quoted.backtick.prisma')).toBe(true)

    const field = findToken(followingLine, 'name2')
    expect(field).toBeDefined()
    expect(hasScope(field!, 'variable.other.assignment.prisma')).toBe(true)
    expect(hasScope(field!, 'string.quoted.backtick.prisma')).toBe(false)

    const type = findToken(followingLine, 'String')
    expect(type).toBeDefined()
    expect(hasScope(type!, 'support.type.primitive.prisma')).toBe(true)
    expect(hasScope(type!, 'string.quoted.backtick.prisma')).toBe(false)
  })
})

describe('double-quoted strings', () => {
  test('an existing "..." string keeps its current scopes', async () => {
    const lines = await tokenizeSchema(`model User {
  other String @default("abc")
}`)
    const fieldLine = lines[1]
    const quotes = fieldLine.filter((token) => token.text === '"')
    const body = findToken(fieldLine, 'abc')

    expect(quotes).toHaveLength(2)
    expect(hasScope(quotes[0], 'string.quoted.double.start.prisma')).toBe(true)
    expect(hasScope(quotes[1], 'string.quoted.double.end.prisma')).toBe(true)
    expect(body).toBeDefined()
    expect(hasScope(body!, 'string.quoted.double.prisma')).toBe(true)
  })

  test('a backslash escapes the next character', async () => {
    const lines = await tokenizeSchema(`model User {
  id String @default("a\\"b") @map("m")
  name String
}`)
    const fieldLine = lines[1]
    const escape = findToken(fieldLine, '\\"')
    expect(escape).toBeDefined()
    expect(hasScope(escape!, 'constant.character.escape.prisma')).toBe(true)

    const mapTag = findToken(fieldLine, '@map')
    expect(mapTag).toBeDefined()
    expect(hasScope(mapTag!, 'entity.name.function.attribute.prisma')).toBe(true)

    const nameField = findToken(lines[2], 'name')
    expect(nameField).toBeDefined()
    expect(hasScope(nameField!, 'variable.other.assignment.prisma')).toBe(true)
  })

  test('an unterminated "..." string ends at the end of its line', async () => {
    const lines = await tokenizeSchema(`model User {
  id String @default("abc
  name String
}

model Post {
  title String @default("untitled")
}`)
    expect(lines[2].some((token) => token.scopes.some((scope) => scope.startsWith('string.')))).toBe(false)

    const quotes = lines[6].filter((token) => token.text === '"')
    expect(quotes).toHaveLength(2)
    expect(hasScope(quotes[0], 'string.quoted.double.start.prisma')).toBe(true)
    expect(hasScope(quotes[1], 'string.quoted.double.end.prisma')).toBe(true)
  })
})
