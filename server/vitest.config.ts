import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/**', 'dist/**', 'src/__tests__/**', 'scripts/**', 'prisma/**'],
      thresholds: {
        lines: 82,
        branches: 70,
        functions: 85,
        statements: 82,
      },
    },
  },
});
