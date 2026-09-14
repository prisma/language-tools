import { describe, expect, test } from 'vitest'
import { isPrismaNextSchema } from '../lib/prismaNext'

describe.each(['prisma-next', 'prisma-8'])('%s directive', (directive) => {
  test.each([
    `// use ${directive}`,
    `// use ${directive}\n\nmodel User {\n  id Int @id\n}\n`,
    `\n\t // use ${directive}\r\n`,
    `//use   ${directive}   `,
    `// use ${directive} additional comment text`,
  ])('recognizes %j', (text) => {
    expect(isPrismaNextSchema(text)).toBe(true)
  })

  test.each([
    `// use ${directive}-extra`,
    `// use ${directive}0`,
    `// use ${directive}.0`,
    `// use${directive}`,
    `// Use ${directive}`,
    `//\tuse ${directive}`,
    `/* use ${directive} */`,
    `// another comment\n// use ${directive}`,
    `model User {}\n// use ${directive}`,
  ])('rejects %j', (text) => {
    expect(isPrismaNextSchema(text)).toBe(false)
  })
})

test.each(['', 'model User {}', '// use prisma-7', '// use prisma-9'])('rejects %j', (text) => {
  expect(isPrismaNextSchema(text)).toBe(false)
})
