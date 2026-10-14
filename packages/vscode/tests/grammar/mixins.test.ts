import { describe, expect, test } from 'vitest'
import { findToken, tokenizeSchema, type Token } from './tokenize'

function expectScope(tokens: Token[], text: string, scope: string): void {
  expect(findToken(tokens, text)?.scopes).toContain(scope)
}

describe('mixins', () => {
  test.each(['model', 'type', 'view', 'enum', 'policy_select', 'generator', 'datasource'])(
    '%s mixin declarations and inclusions',
    async (keyword) => {
      const lines = await tokenizeSchema(`${keyword} mixin Shared {
  +Base
  + auth.Other
}`)
      expectScope(
        lines[0],
        keyword,
        `storage.type.${['model', 'type', 'view'].includes(keyword) ? 'model' : keyword === 'enum' ? 'enum' : 'config'}.prisma`,
      )
      expectScope(lines[0], 'mixin', 'storage.modifier.mixin.prisma')
      expect(findToken(lines[0], 'Shared')?.scopes.some((scope) => scope.startsWith('entity.name.type.'))).toBe(true)
      expectScope(lines[0], '{', 'punctuation.definition.tag.prisma')
      expectScope(lines[1], '+', 'keyword.operator.mixin.prisma')
      expectScope(lines[1], 'Base', 'entity.name.type.mixin.prisma')
      expectScope(lines[2], 'auth.Other', 'entity.name.type.mixin.prisma')
      expectScope(lines[3], '}', 'punctuation.definition.tag.prisma')
    },
  )

  test.each(['model', 'type', 'view', 'enum'])(
    '%s accepts inclusions without changing ordinary headers',
    async (keyword) => {
      const lines = await tokenizeSchema(`${keyword} Example { +Shared
}`)
      expectScope(lines[0], '+', 'keyword.operator.mixin.prisma')
      expectScope(lines[0], 'Shared', 'entity.name.type.mixin.prisma')
      expect(lines.flat().some((token) => token.scopes.includes('storage.modifier.mixin.prisma'))).toBe(false)
    },
  )

  test('namespace mixins retain field, enum, assignment, attribute and comment highlighting', async () => {
    const lines = await tokenizeSchema(`namespace auth {
  model mixin Stamped {
    createdAt DateTime @default(now())
    @@index([createdAt])
    // +Ignored
  }
  enum mixin Roles {
    ADMIN @map("admin")
  }
  policy_select mixin OwnerRead {
    roles = [authenticated]
    @@map("owner")
  }
  model User {
    +auth.Stamped
    mixin Int @default(+1)
  }
}`)
    expectScope(lines[1], 'mixin', 'storage.modifier.mixin.prisma')
    expectScope(lines[2], 'createdAt', 'variable.other.assignment.prisma')
    expectScope(lines[2], 'DateTime', 'support.type.primitive.prisma')
    expectScope(lines[2], '@default', 'entity.name.function.attribute.prisma')
    expectScope(lines[3], '@@index', 'entity.name.function.attribute.prisma')
    expect(
      lines[4]
        .filter((token) => token.text.includes('Ignored'))
        .every((token) => token.scopes.includes('comment.prisma')),
    ).toBe(true)
    expectScope(lines[6], 'mixin', 'storage.modifier.mixin.prisma')
    expectScope(lines[7], 'ADMIN', 'variable.other.assignment.prisma')
    expectScope(lines[7], '@map', 'entity.name.function.attribute.prisma')
    expectScope(lines[9], 'mixin', 'storage.modifier.mixin.prisma')
    expectScope(lines[10], 'roles', 'variable.other.assignment.prisma')
    expectScope(lines[11], '@@map', 'entity.name.function.attribute.prisma')
    expectScope(lines[14], 'auth.Stamped', 'entity.name.type.mixin.prisma')
    expectScope(lines[15], 'mixin', 'variable.other.assignment.prisma')
    expectScope(lines[15], '+1', 'constant.numeric.prisma')
  })

  test('inclusions are not highlighted at top level, in namespaces or in types blocks', async () => {
    const lines = await tokenizeSchema(`+Shared
namespace auth {
  +Shared
}
types {
  +Shared
}`)
    expect(lines.flat().some((token) => token.scopes.includes('keyword.operator.mixin.prisma'))).toBe(false)
  })
})
