import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const plugins = [react()]

  // Note: To use bundle analyzer, run: npm run build:analyze
  // This requires rollup-plugin-visualizer to be installed
  // The visualizer config is in vite.config.analyze.js

  return {
    plugins,
    server: {
      port: 5174,
      open: true
    },
    build: {
      outDir: 'dist',
      // Disable sourcemaps in production for smaller bundles
      sourcemap: mode !== 'production',
      // Use esbuild for faster minification (default)
      minify: 'esbuild',
      // Enable CSS code splitting
      cssCodeSplit: true,
      // Target modern browsers for smaller bundles
      target: 'es2020',
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // Supabase client - separate chunk
            if (id.includes('node_modules/@supabase')) {
              return 'vendor-supabase'
            }
            // Firebase - separate chunk
            if (id.includes('node_modules/firebase')) {
              return 'vendor-firebase'
            }
            // Date utilities - separate chunk
            if (id.includes('node_modules/date-fns')) {
              return 'vendor-dates'
            }
            // Sentry (lazy loaded)
            if (id.includes('node_modules/@sentry')) {
              return 'vendor-sentry'
            }
            // All other node_modules go to a single vendor chunk
            // This avoids circular dependency issues between react/recharts/d3
            if (id.includes('node_modules')) {
              return 'vendor'
            }
          },
        },
      },
      // Lower chunk size warning to catch regressions
      chunkSizeWarningLimit: 400,
      // Enable asset inlining for smaller files
      assetsInlineLimit: 4096, // 4KB
    },
    // Enable tree-shaking for production
    esbuild: {
      // Remove console.log in production
      drop: mode === 'production' ? ['console', 'debugger'] : [],
    },
    // Optimize dependencies for faster dev startup
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', 'date-fns', 'clsx'],
      // Exclude heavy deps from pre-bundling to reduce memory usage
      exclude: ['@sentry/react'],
    },
    // Define production replacements
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0'),
    },
  }
})
