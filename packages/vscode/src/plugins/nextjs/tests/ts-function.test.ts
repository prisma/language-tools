import { buildVariations } from './__helpers__/buildVariations'
import { TestContext } from './__helpers__/context'
import { runTestProject } from './__helpers__/testProject'

const ctx = new TestContext()

describe('function tests -', () => {
  beforeEach(async () => {
    await ctx.beforeEach()
  })

  afterEach(async () => {
    await ctx.afterEach()
  })
  const variations = buildVariations('tsx', {
    page: (value) => {
      return value.includes('function')
    },
  })
  Object.keys(variations).map((testFileName) => {
    test(testFileName.split('_').join(' '), async () => {
      const testDir = await ctx.setup({
        fs: { [testFileName]: variations[testFileName] },
      })

      await runTestProject(testDir, testFileName)
      await ctx.snapshotFiles()
    })
  })
})
