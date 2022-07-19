module.exports = {
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverage: process.env.CI ? true : false,
  coverageReporters: ['clover'],
  coverageDirectory: 'scripts/__tests__/coverage',
  collectCoverageFrom: ['scripts/**/*.js', '!**/__tests__/**/*'],
  reporters: ['default', 'github-actions'],
}
