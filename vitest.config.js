import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { loadBuildInfo } from './scripts/lib/buildInfo.mjs'

export default defineConfig(async () => ({
  plugins: [react()],
  // The same build facts the site gets (vite.config.js)
  define: {
    __VIGIL_BUILD__: JSON.stringify(await loadBuildInfo()),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    // workers/ runs the ingestion. It had no tests at all until the scheduler
    // rewrite, which is part of why a silent failure lasted four months.
    // scripts/ had no coverage either, and now carries the feed-health check
    // that is the only thing telling anyone when ingestion stops.
    // supabase/tests runs SQL in a real Postgres (PGlite, in-process): the
    // logic that lives in migrations had no tests before it reached live.
    include: [
      'src/**/*.{test,spec}.{js,jsx}',
      'workers/**/*.{test,spec}.js',
      'scripts/**/*.{test,spec}.{js,mjs}',
      'supabase/tests/**/*.test.js',
    ],
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
}))
