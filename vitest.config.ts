import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'server/app.ts', 'server/config.ts'],
      exclude: ['**/*.test.ts', 'src/domain/types.ts', 'src/domain/mock.ts', 'src/domain/prompts.ts'],
      reporter: ['text-summary', 'lcov'],
      thresholds: { lines: 85, functions: 72, branches: 65 },
    },
  },
})
