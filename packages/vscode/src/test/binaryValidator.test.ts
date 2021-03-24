import {
  checkAndAskForBinaryExecution,
  BinaryStorage,
} from '../binaryValidator'
import * as asset from 'assert'

suite('Binary validation test', () => {
  const context: any = {
    globalState: {
      update: () => {
        /**/
      },
    },
  }
  test('should return false when path is in deny state', async () => {
    const path = '/user/bin/test'

    const bins: BinaryStorage = { libs: { [path]: { allowed: false } } }

    const checkResult = await checkAndAskForBinaryExecution(context, path, bins)
    asset.strictEqual(checkResult, false)
  })

  test('should return true when path is in allow state', async () => {
    const path = '/user/bin/test'

    const bins: BinaryStorage = { libs: { [path]: { allowed: true } } }

    const checkResult = await checkAndAskForBinaryExecution(context, path, bins)
    asset.strictEqual(checkResult, true)
  })
})
