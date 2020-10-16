import { buildVariations, FileExtension, Filter } from './buildVariations'
import { TestContext } from './context'
import { runTestProject } from './testProject'

// TODO Refactor Tests
const ctx = new TestContext()

export function buildTest(
  extension: FileExtension,
  filter?:
    | {
        import?: Filter | undefined
        export?: Filter | undefined
        page?: Filter | undefined
      }
    | undefined,
) {
  return () => {
    beforeEach(async () => {
      await ctx.beforeEach()
    })

    afterEach(async () => {
      await ctx.afterEach()
    })
    const variations = buildVariations(extension, filter)
    Object.keys(variations).map((testFileName) => {
      test(testFileName.split('_').join(' '), async () => {
        const testDir = await ctx.setup({
          fs: { [testFileName]: variations[testFileName] },
        })

        await runTestProject(testDir, testFileName)
        await ctx.snapshotFiles()
      })
    })
  }
}
