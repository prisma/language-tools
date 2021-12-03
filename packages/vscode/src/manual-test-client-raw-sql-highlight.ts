/* eslint-disable */
// @ts-nocheck
async function main() {
  // How to use?
  // Build and start VS Code extension
  // Open this file
  // Check that highligting works
  const db: any
  const raw: any
  const sql: any
  const join: any
  const empty: any

  /**
   * queryRaw
   */

  // Test queryRaw(string)
  const rawQuery = await db.$queryRawUnsafe('SELECT 1') // TODO support ('', ...?)

  // Test queryRaw(string, values)
  const rawQueryWithValues = await db.$queryRawUnsafe(
    // TODO
    'SELECT $1 AS name, $2 AS id',
    'Alice',
    42,
  )

  // Test queryRaw``
  const rawQueryTemplate = await db.$queryRaw`SELECT 1` // works!

  // Test queryRaw`` with ${param}
  const rawQueryTemplateWithParams =
    await db.$queryRaw`SELECT * FROM User WHERE name = ${'Alice'}` // works!

  // Test queryRaw`` with prisma.sql``
  const rawQueryTemplateFromSqlTemplate = await db.$queryRaw(
    // TODO support sql``
    sql`
      SELECT ${join([raw('email'), raw('id'), raw('name')])}
      FROM ${raw('User')}
      ${sql`WHERE name = ${'Alice'}`}
      ${empty}
    `,
  )

  /**
   * .$executeRaw(
   */

  // Test .$executeRaw((string)
  const executeRaw = await db.$executeRawUnsafe(
    // TODO support ('', ...?)
    'UPDATE User SET name = $1 WHERE id = $2',
    'name',
    'id',
  )

  // Test .$executeRaw((string, values)
  const executeRawWithValues = await db.$executeRawUnsafe(
    // TODO support ('', ...?)
    'UPDATE User SET name = $1 WHERE id = $2',
    'Alice',
    'id',
  )

  // Test $executeRaw
  const $executeRawTemplate =
    await db.$executeRaw`UPDATE User SET name = ${'name'} WHERE id = ${'id'}` // works!
}
