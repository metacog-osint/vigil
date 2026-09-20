import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    // workers/ runs the ingestion. It had no tests at all until the scheduler
    // rewrite, which is part of why a silent failure lasted four months.
    include: ['src/**/*.{test,spec}.{js,jsx}', 'workers/**/*.{test,spec}.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.test.{js,jsx}',
        '**/__tests__/**',
        'scripts/',
        'e2e/',
        '*.config.*',
      ],
      thresholds: {
        statements: 35,
        branches: 25,
        functions: 25,
        lines: 35,
      },
    },
  },
})
