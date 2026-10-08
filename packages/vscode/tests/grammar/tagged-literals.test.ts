import { describe, expect, test } from 'vitest'
import { expectHighlighting, findToken, hasScope, tokenizeSchema } from './tokenize'

describe('tag families across fences', () => {
  test('sql, pg.sql and sqlite.sql inject SQL in every fence; json, jsonb and pg.jsonb inject JSON in backtick and single-quote fences only; foo.bar never injects', async () => {
    await expectHighlighting(`model User {
  a String @default(sql\`<sql>select 1</sql>\`)
  b String @default(sql'<sql>select 1</sql>')
  c String @default(sql"<sql>select 1</sql>")
  d String @default(pg.sql\`<sql>select 1</sql>\`)
  e String @default(pg.sql'<sql>select 1</sql>')
  f String @default(pg.sql"<sql>select 1</sql>")
  g String @default(sqlite.sql\`<sql>select 1</sql>\`)
  h String @default(sqlite.sql'<sql>select 1</sql>')
  i String @default(sqlite.sql"<sql>select 1</sql>")
  j Json @default(json\`<json>{}</json>\`)
  k Json @default(json'<json>{}</json>')
  l Json @default(json"{}")
  m Json @default(jsonb\`<json>{}</json>\`)
  n Json @default(jsonb'<json>{}</json>')
  o Json @default(jsonb"{}")
  p Json @default(pg.jsonb\`<json>{}</json>\`)
  q Json @default(pg.jsonb'<json>{}</json>')
  r Json @default(pg.jsonb"{}")
  s Json @default(foo.bar\`abc\`)
  t Json @default(foo.bar'abc')
  u Json @default(foo.bar"abc")
}`)
  })
})

describe('multi-line backtick bodies', () => {
  test('a multi-line JSON body keeps JSON scopes through the closing line', async () => {
    await expectHighlighting(`model User {
  meta Json @default(json\`<json>{
    "a": 1,
    "b": [1,
      2]}</json>\`)
}`)
  })

  test('a multi-line SQL body keeps SQL scopes through the closing line', async () => {
    await expectHighlighting(`model User {
  value String @default(sql\`<sql>select
    1</sql>\`)
}`)
  })
})

describe('a SQL line comment inside a backtick body', () => {
  test('a single-line body ends at the closing backtick', async () => {
    await expectHighlighting(`model User {
  id String @default(sql\`<sql>now() -- note</sql>\`) @map("m")
  name String
}`)
  })

  test('a comment on the closing line of a multi-line body ends at the closing backtick', async () => {
    await expectHighlighting(`model User {
  id String @default(sql\`
<sql>    select 1
    from t -- note</sql>\`) @map("m")
  name String
}`)
  })
})

describe('fence escapes inside injected bodies', () => {
  test('backtick escapes stay inside the injected SQL body', async () => {
    await expectHighlighting(`model User {
  value String @default(sql\`<sql>a\\\`b\\\\c\\\$d</sql>\`)
}`)
  })

  test('quote escapes stay inside the injected SQL body', async () => {
    await expectHighlighting(`model User {
  value String @default(sql'<sql>select \\'1\\'</sql>')
}`)
  })
})

describe('malformed quote-fenced bodies', () => {
  test.each([
    {
      name: 'an unclosed SQL string opened by an inner single quote ends at the closing fence',
      annotated: `model User {
  id String @default(sql"<sql>select 'abc</sql>") @map("m")
  name String
}`,
    },
    {
      name: 'an unclosed SQL comment ends at the closing fence',
      annotated: `model User {
  id String @default(sql'<sql>select /* x</sql>') @map("m")
  name String
}`,
    },
    {
      name: 'an unclosed JSON object and array end at the closing fence',
      annotated: `model User {
  id Json @default(json'<json>{"a": [1</json>') @map("m")
  name String
}`,
    },
  ])('$name', async ({ annotated }) => {
    await expectHighlighting(annotated)
  })
})

describe('tag and fence split across lines', () => {
  test('the body is not injected when the fence is on the next line', async () => {
    await expectHighlighting(`model User {
  value String @default(sql
    \`select 1\`)
}`)
  })
})

describe('a bare backtick string', () => {
  test('is not injected without a tag', async () => {
    await expectHighlighting(`model User {
  value String @default(\`abc\`)
}`)
  })
})

describe('tagged literals in other value positions', () => {
  test('inside an array', async () => {
    await expectHighlighting(`model User {
  docs Json[] @default([json'<json>{}</json>', json\`<json>[]</json>\`])
}`)
  })

  test('as a named argument', async () => {
    await expectHighlighting(`model User {
  id Int
  @@index([id], where: sql\`<sql>id > 1</sql>\`)
}`)
  })

  test('in a datasource assignment', async () => {
    await expectHighlighting(`datasource db {
  url = sql\`<sql>select 1</sql>\`
}`)
  })
})

describe('regression: existing value tokenisation is unchanged', () => {
  test('uuid(), now(), @relation arguments and a plain assignment value stay unhighlighted', async () => {
    await expectHighlighting(`model User {
  id String @default(uuid())
  createdAt DateTime @default(now())
  author User @relation(fields: [a], references: [b])
}

datasource db {
  provider = "postgresql"
}`)
  })
})

describe('scopes the annotations do not show', () => {
  test('the tag has the tagged-template scope', async () => {
    const lines = await tokenizeSchema(`model User {
  value String @default(sql\`select 1\`)
}`)
    const tag = findToken(lines[1], 'sql')
    expect(tag).toBeDefined()
    expect(hasScope(tag!, 'entity.name.function.tagged-template.prisma')).toBe(true)
  })

  test('the injected fence has begin and end punctuation scopes', async () => {
    const lines = await tokenizeSchema(`model User {
  value String @default(sql\`select 1\`)
}`)
    const fences = lines[1].filter((token) => token.text === '`')
    expect(fences).toHaveLength(2)
    expect(hasScope(fences[0], 'punctuation.definition.string.begin.prisma')).toBe(true)
    expect(hasScope(fences[1], 'punctuation.definition.string.end.prisma')).toBe(true)
  })

  test('a non-injected body keeps its plain string scope', async () => {
    const lines = await tokenizeSchema(`model User {
  value Json @default(json"abc")
}`)
    const body = findToken(lines[1], 'abc')
    expect(body).toBeDefined()
    expect(hasScope(body!, 'string.quoted.double.prisma')).toBe(true)
  })

  test('escaped quotes in a non-injected body do not end the string early', async () => {
    const lines = await tokenizeSchema(`model User {
  meta Json @default(json"{\\"plan\\": \\"free\\"}") @map("m")
  name String
}`)
    const fieldLine = lines[1]
    const plan = findToken(fieldLine, 'plan')
    expect(plan).toBeDefined()
    expect(hasScope(plan!, 'string.quoted.double.prisma')).toBe(true)

    const mapTag = findToken(fieldLine, '@map')
    expect(mapTag).toBeDefined()
    expect(hasScope(mapTag!, 'entity.name.function.attribute.prisma')).toBe(true)

    const nameField = findToken(lines[2], 'name')
    expect(nameField).toBeDefined()
    expect(hasScope(nameField!, 'variable.other.assignment.prisma')).toBe(true)
  })

  test('an escape token has the escape scope', async () => {
    const lines = await tokenizeSchema(`model User {
  value String @default(sql\`a\\\`b\`)
}`)
    const escape = findToken(lines[1], '\\`')
    expect(escape).toBeDefined()
    expect(hasScope(escape!, 'constant.character.escape.prisma')).toBe(true)
  })

  test('no token in the regression schema or the split tag/fence schema gets the tag scope', async () => {
    const regressionLines = await tokenizeSchema(`model User {
  id String @default(uuid())
  createdAt DateTime @default(now())
  author User @relation(fields: [a], references: [b])
}

datasource db {
  provider = "postgresql"
}`)
    const splitLines = await tokenizeSchema(`model User {
  value String @default(sql
    \`select 1\`)
}`)

    for (const tokens of [...regressionLines, ...splitLines]) {
      for (const token of tokens) {
        expect(hasScope(token, 'entity.name.function.tagged-template.prisma')).toBe(false)
      }
    }
  })
})
