import { buildTest } from './__helpers__/buildTests'

describe(
  'jsdoc function tests - ',
  buildTest('jsx', {
    page: (value) => value.includes('function'),
  }),
)
describe(
  'ts const tests - ',
  buildTest('tsx', {
    page: (value) => value.includes('const'),
  }),
)
describe(
  'ts function tests - ',
  buildTest('tsx', {
    page: (value) => value.includes('function'),
  }),
)
