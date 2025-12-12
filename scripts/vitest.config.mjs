import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['**/__tests__/**/*.test.mjs'],
    coverage: {
      enabled: !!process.env.CI,
      provider: 'v8',
      reporter: ['clover'],
      reportsDirectory: 'scripts/__tests__/coverage',
      include: ['scripts/**/*.{js,mjs}'],
      exclude: ['**/__tests__/**/*'],
    },
    reporters: process.env.CI ? ['default', 'github-actions'] : ['default'],
  },
})
