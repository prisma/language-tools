import { TestContext } from './__helpers__/context'
import { regression_602 } from './__fixtures__/regressions'
import { runTestProject } from './__helpers__/testProject'

const ctx = new TestContext()

describe('regressions - ', () => {
  beforeEach(async () => {
    await ctx.beforeEach()
  })

  afterEach(async () => {
    await ctx.afterEach()
  })
  test('regression', async () => {
    const testDir = await ctx.setup({
      fs: { 'test.ts': regression_602 },
    })

    await runTestProject(testDir, 'test.ts')
    await ctx.snapshotFiles()
  })
})
