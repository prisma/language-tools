module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  snapshotSerializers: ['jest-snapshot-serializer-raw'],
  modulePathIgnorePatterns: [
    'build/',
    'dist/',
    '__helpers__',
    'node_modules/',
    'src/test',
  ],
  globals: {
    'ts-jest': {
      packageJson: 'package.json',
    },
  },
  testTimeout: 10000,
}
