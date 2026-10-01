import { describe, expect, test } from 'vitest'
import { findToken, hasScope, tokenizeSchema, type Token } from './tokenize'

function isEmbedded(token: Token, language: 'sql' | 'json'): boolean {
  const blockScope = `meta.embedded.block.${language}`
  if (!hasScope(token, blockScope)) {
    return false
  }
  return token.scopes.some((scope) => scope !== blockScope && scope.endsWith(`.${language}`))
}

function isNotEmbedded(token: Token): boolean {
  return !token.scopes.some((scope) => scope.startsWith('meta.embedded.block.'))
}

function plainStringScope(fence: '`' | "'" | '"'): string {
  if (fence === '`') {
    return 'string.quoted.backtick.prisma'
  }
  if (fence === "'") {
    return 'string.quoted.single.prisma'
  }
  return 'string.quoted.double.prisma'
}

function defaultSchema(tag: string, fence: '`' | "'" | '"', body: string): string {
  return `model User {
  value Json @default(${tag}${fence}${body}${fence})
}`
}

describe('tag families across fences', () => {
  const embeddedCases: Array<{ tag: string; fence: '`' | "'" | '"'; language: 'sql' | 'json' }> = [
    { tag: 'sql', fence: '`', language: 'sql' },
    { tag: 'sql', fence: "'", language: 'sql' },
    { tag: 'sql', fence: '"', language: 'sql' },
    { tag: 'pg.sql', fence: '`', language: 'sql' },
    { tag: 'pg.sql', fence: "'", language: 'sql' },
    { tag: 'pg.sql', fence: '"', language: 'sql' },
    { tag: 'sqlite.sql', fence: '`', language: 'sql' },
    { tag: 'sqlite.sql', fence: "'", language: 'sql' },
    { tag: 'sqlite.sql', fence: '"', language: 'sql' },
    { tag: 'json', fence: '`', language: 'json' },
    { tag: 'json', fence: "'", language: 'json' },
    { tag: 'jsonb', fence: '`', language: 'json' },
    { tag: 'jsonb', fence: "'", language: 'json' },
    { tag: 'pg.jsonb', fence: '`', language: 'json' },
    { tag: 'pg.jsonb', fence: "'", language: 'json' },
  ]

  test.each(embeddedCases)('$tag in $fence is embedded as $language', async ({ tag, fence, language }) => {
    const body = language === 'sql' ? 'select 1' : '{}'
    const lines = await tokenizeSchema(defaultSchema(tag, fence, body))
    const fieldLine = lines[1]

    const tagToken = findToken(fieldLine, tag)
    expect(tagToken).toBeDefined()
    expect(hasScope(tagToken!, 'entity.name.function.tagged-template.prisma')).toBe(true)

    expect(fieldLine.some((token) => isEmbedded(token, language))).toBe(true)
  })

  const notEmbeddedCases: Array<{ tag: string; fence: '`' | "'" | '"' }> = [
    { tag: 'json', fence: '"' },
    { tag: 'jsonb', fence: '"' },
    { tag: 'pg.jsonb', fence: '"' },
    { tag: 'foo.bar', fence: '`' },
    { tag: 'foo.bar', fence: "'" },
    { tag: 'foo.bar', fence: '"' },
  ]

  test.each(notEmbeddedCases)(
    '$tag in $fence is not embedded and keeps a plain string body',
    async ({ tag, fence }) => {
      const lines = await tokenizeSchema(defaultSchema(tag, fence, 'abc'))
      const fieldLine = lines[1]

      const tagToken = findToken(fieldLine, tag)
      expect(tagToken).toBeDefined()
      expect(hasScope(tagToken!, 'entity.name.function.tagged-template.prisma')).toBe(true)

      expect(fieldLine.every(isNotEmbedded)).toBe(true)

      const body = findToken(fieldLine, 'abc')
      expect(body).toBeDefined()
      expect(hasScope(body!, plainStringScope(fence))).toBe(true)
    },
  )
})

describe('multi-line backtick bodies', () => {
  test('a multi-line JSON body keeps JSON scopes on the closing line', async () => {
    const schema = `model User {
  meta Json @default(json\`{
    "a": 1,
    "b": [1,
      2]}\`)
}`
    const lines = await tokenizeSchema(schema)
    const closingLine = lines[4]

    const closingBracket = findToken(closingLine, ']')
    expect(closingBracket).toBeDefined()
    expect(hasScope(closingBracket!, 'punctuation.definition.array.end.json')).toBe(true)
    expect(isEmbedded(closingBracket!, 'json')).toBe(true)

    const closingBrace = findToken(closingLine, '}')
    expect(closingBrace).toBeDefined()
    expect(hasScope(closingBrace!, 'punctuation.definition.dictionary.end.json')).toBe(true)
    expect(isEmbedded(closingBrace!, 'json')).toBe(true)

    const fence = findToken(closingLine, '`')
    expect(fence).toBeDefined()
    expect(hasScope(fence!, 'punctuation.definition.string.end.prisma')).toBe(true)
  })

  test('a multi-line SQL body is embedded on every line', async () => {
    const schema = `model User {
  value String @default(sql\`select
    1\`)
}`
    const lines = await tokenizeSchema(schema)
    const openingLine = lines[1]
    const closingLine = lines[2]

    const select = findToken(openingLine, 'select')
    expect(select).toBeDefined()
    expect(isEmbedded(select!, 'sql')).toBe(true)

    const one = findToken(closingLine, '1')
    expect(one).toBeDefined()
    expect(isEmbedded(one!, 'sql')).toBe(true)
  })
})

describe('fence escapes inside injected bodies', () => {
  test('backtick escapes are recognised inside an embedded SQL body', async () => {
    const schema = `model User {
  value String @default(sql\`a\\\`b\\\\c\\\$d\`)
}`
    const lines = await tokenizeSchema(schema)
    const fieldLine = lines[1]

    for (const escape of ['\\`', '\\\\', '\\$']) {
      const token = findToken(fieldLine, escape)
      expect(token).toBeDefined()
      expect(hasScope(token!, 'constant.character.escape.prisma')).toBe(true)
      expect(hasScope(token!, 'meta.embedded.block.sql')).toBe(true)
    }
  })

  test('quote escapes are recognised inside an embedded SQL quoted body', async () => {
    const schema = `model User {
  value String @default(sql'select \\'1\\'')
}`
    const lines = await tokenizeSchema(schema)
    const fieldLine = lines[1]

    const escapes = fieldLine.filter((token) => token.text === "\\'")
    expect(escapes).toHaveLength(2)
    for (const escape of escapes) {
      expect(hasScope(escape, 'constant.character.escape.prisma')).toBe(true)
      expect(hasScope(escape, 'meta.embedded.block.sql')).toBe(true)
    }
  })

  test('a double-quote escape inside an embedded SQL quoted body closes correctly', async () => {
    const schema = `model User {
  id String @default(sql"select \\"x") @map("y")
  name String
}`
    const lines = await tokenizeSchema(schema)
    const fieldLine = lines[1]
    const followingLine = lines[2]

    const select = findToken(fieldLine, 'select')
    expect(select).toBeDefined()
    expect(isEmbedded(select!, 'sql')).toBe(true)

    const escape = findToken(fieldLine, '\\"')
    expect(escape).toBeDefined()
    expect(hasScope(escape!, 'constant.character.escape.prisma')).toBe(true)
    expect(hasScope(escape!, 'meta.embedded.block.sql')).toBe(true)

    const x = findToken(fieldLine, 'x')
    expect(x).toBeDefined()
    expect(hasScope(x!, 'meta.embedded.block.sql')).toBe(true)

    const mapTag = findToken(fieldLine, '@map')
    expect(mapTag).toBeDefined()
    expect(isNotEmbedded(mapTag!)).toBe(true)

    const y = findToken(fieldLine, 'y')
    expect(y).toBeDefined()
    expect(hasScope(y!, 'string.quoted.double.prisma')).toBe(true)
    expect(isNotEmbedded(y!)).toBe(true)

    const nameField = findToken(followingLine, 'name')
    expect(nameField).toBeDefined()
    expect(hasScope(nameField!, 'variable.other.assignment.prisma')).toBe(true)
    expect(isNotEmbedded(nameField!)).toBe(true)
  })
})

describe('tag and fence split across lines', () => {
  test('the body is not embedded when the fence is on the next line', async () => {
    const schema = `model User {
  value String @default(sql
    \`select 1\`)
}`
    const lines = await tokenizeSchema(schema)
    const tagLine = lines[1]
    const fenceLine = lines[2]

    const tag = findToken(tagLine, 'sql')
    expect(tag).toBeDefined()
    expect(hasScope(tag!, 'entity.name.function.tagged-template.prisma')).toBe(false)

    const open = findToken(fenceLine, '`')
    expect(open).toBeDefined()
    expect(hasScope(open!, 'string.quoted.backtick.start.prisma')).toBe(true)
    expect(fenceLine.every(isNotEmbedded)).toBe(true)
  })
})

describe('a bare backtick string', () => {
  test('is still a plain string without a tag', async () => {
    const lines = await tokenizeSchema(`model User {
  value String @default(\`abc\`)
}`)
    const fieldLine = lines[1]
    const open = findToken(fieldLine, '`')
    expect(open).toBeDefined()
    expect(hasScope(open!, 'string.quoted.backtick.start.prisma')).toBe(true)
    expect(fieldLine.every(isNotEmbedded)).toBe(true)
  })
})

describe('tagged literals in other value positions', () => {
  test('inside an array', async () => {
    const lines = await tokenizeSchema(`model User {
  docs Json[] @default([json'{}', json\`[]\`])
}`)
    const fieldLine = lines[1]
    const embeddedTokens = fieldLine.filter((token) => isEmbedded(token, 'json'))
    expect(embeddedTokens.length).toBeGreaterThanOrEqual(2)
  })

  test('as a named argument', async () => {
    const lines = await tokenizeSchema(`model User {
  id Int
  @@index([id], where: sql\`id > 1\`)
}`)
    const fieldLine = lines[2]
    const comparison = findToken(fieldLine, '>')
    expect(comparison).toBeDefined()
    expect(isEmbedded(comparison!, 'sql')).toBe(true)
  })

  test('in a datasource assignment', async () => {
    const lines = await tokenizeSchema(`datasource db {
  url = sql\`select 1\`
}`)
    const fieldLine = lines[1]
    const select = findToken(fieldLine, 'select')
    expect(select).toBeDefined()
    expect(isEmbedded(select!, 'sql')).toBe(true)
  })
})

describe('regression: existing value tokenisation is unchanged', () => {
  test('uuid() stays a function call', async () => {
    const lines = await tokenizeSchema(`model User {
  id String @default(uuid())
}`)
    const fieldLine = lines[1]
    const fn = findToken(fieldLine, 'uuid')
    expect(fn).toBeDefined()
    expect(hasScope(fn!, 'support.function.functional.prisma')).toBe(true)
  })

  test('now() stays a function call', async () => {
    const lines = await tokenizeSchema(`model User {
  createdAt DateTime @default(now())
}`)
    const fieldLine = lines[1]
    const fn = findToken(fieldLine, 'now')
    expect(fn).toBeDefined()
    expect(hasScope(fn!, 'support.function.functional.prisma')).toBe(true)
  })

  test('@relation arguments stay named arguments', async () => {
    const lines = await tokenizeSchema(`model User {
  author User @relation(fields: [a], references: [b])
}`)
    const fieldLine = lines[1]
    const fields = findToken(fieldLine, 'fields')
    expect(fields).toBeDefined()
    expect(hasScope(fields!, 'variable.parameter.key.prisma')).toBe(true)
    const a = findToken(fieldLine, 'a')
    expect(a).toBeDefined()
    expect(hasScope(a!, 'support.constant.constant.prisma')).toBe(true)
  })

  test('a plain assignment value stays a plain string', async () => {
    const lines = await tokenizeSchema(`datasource db {
  provider = "postgresql"
}`)
    const fieldLine = lines[1]
    const value = findToken(fieldLine, 'postgresql')
    expect(value).toBeDefined()
    expect(hasScope(value!, 'string.quoted.double.prisma')).toBe(true)
  })
})

describe('malformed quote-fenced bodies', () => {
  const malformedCases: Array<{ name: string; literal: string; fence: '"' | "'" }> = [
    { name: 'an embedded SQL string left open by an inner single quote', literal: `sql"select 'abc"`, fence: '"' },
    { name: 'an embedded SQL comment left open by an inner /*', literal: `sql'select /* x'`, fence: "'" },
    { name: 'an embedded JSON object and array left open', literal: `json'{"a": [1'`, fence: "'" },
  ]

  test.each(malformedCases)('$name does not leak past the closing fence', async ({ literal, fence }) => {
    const schema = `model User {
  id String @default(${literal}) @map("m")
  name String
}`
    const lines = await tokenizeSchema(schema)
    const fieldLine = lines[1]
    const followingLine = lines[2]

    const closingFence = fieldLine.find(
      (token) => token.text === fence && hasScope(token, 'punctuation.definition.string.end.prisma'),
    )
    expect(closingFence).toBeDefined()

    const mapTag = findToken(fieldLine, '@map')
    expect(mapTag).toBeDefined()
    expect(isNotEmbedded(mapTag!)).toBe(true)

    const m = findToken(fieldLine, 'm')
    expect(m).toBeDefined()
    expect(hasScope(m!, 'string.quoted.double.prisma')).toBe(true)
    expect(isNotEmbedded(m!)).toBe(true)

    const nameField = findToken(followingLine, 'name')
    expect(nameField).toBeDefined()
    expect(hasScope(nameField!, 'variable.other.assignment.prisma')).toBe(true)
    expect(isNotEmbedded(nameField!)).toBe(true)
  })
})
