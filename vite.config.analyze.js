/**
 * Vite config for bundle analysis
 * Run with: npm run build:analyze
 */

import { defineConfig, mergeConfig } from 'vite'
import { visualizer } from 'rollup-plugin-visualizer'
import baseConfig from './vite.config.js'

export default defineConfig((configEnv) => {
  const base = typeof baseConfig === 'function' ? baseConfig(configEnv) : baseConfig

  return mergeConfig(base, {
    plugins: [
      visualizer({
        filename: 'stats.html',
        open: true,
        gzipSize: true,
        brotliSize: true,
        template: 'treemap', // or 'sunburst', 'network'
      }),
    ],
  })
})
