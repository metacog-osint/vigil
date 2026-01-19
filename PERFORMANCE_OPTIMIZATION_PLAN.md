# Performance Optimization Plan

> Plan to achieve performance targets: bundle size <1MB, page load <2s.
>
> **Created:** January 17, 2026
> **Related:** ROADMAP.md (Performance Targets), CODE_IMPROVEMENT_PLAN.md (Tasks 11-12)

---

## Current State

### Bundle Analysis (as of Jan 17, 2026)

| Chunk | Size | Gzipped | Notes |
|-------|------|---------|-------|
| `index-*.js` | **531.87 KB** | 150.88 KB | Main bundle - OVER 500KB WARNING |
| `vendor-charts-*.js` | 421.52 KB | 112.42 KB | Recharts + D3 |
| `vendor-supabase-*.js` | 172.49 KB | 44.54 KB | Supabase client |
| `vendor-react-*.js` | 164.56 KB | 53.72 KB | React + ReactDOM |
| `SettingsLayout-*.js` | 147.53 KB | 34.65 KB | Settings pages |

**Total Estimated:** ~1.5MB uncompressed, ~450KB gzipped

### Performance Targets

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Bundle size | ~1.5 MB | <1 MB | -500 KB |
| Page load (P95) | ~2.5s | <2s | -0.5s |
| Search latency | ~600ms | <500ms | -100ms |

---

## Phase 1: Bundle Size Reduction (P0)

### Task 1.1: Chart Library Optimization
**Problem:** `vendor-charts-*.js` is 421 KB
**Solutions:**
1. **Tree-shake Recharts** - Only import used components
   ```javascript
   // Instead of:
   import { LineChart, BarChart, ... } from 'recharts'
   // Use:
   import { LineChart } from 'recharts/es6/chart/LineChart'
   ```
2. **Consider alternatives:**
   - `lightweight-charts` (40 KB) for time series
   - `uplot` (30 KB) for simple charts
   - Server-side chart rendering for static charts

### Task 1.2: Main Bundle Code Splitting
**Problem:** `index-*.js` is 531 KB (over 500 KB warning)
**Solutions:**
1. **Lazy load pages** (partially done, verify completeness)
   ```javascript
   const ThreatActors = lazy(() => import('./pages/ThreatActors'))
   const Settings = lazy(() => import('./pages/Settings'))
   ```
2. **Move large components to separate chunks**
   - `EntityRelationshipGraph` (uses D3 force)
   - `IOCCorrelationGraph`
   - `AttackMatrixHeatmap`

### Task 1.3: Settings Page Optimization
**Problem:** `SettingsLayout-*.js` is 147 KB
**Solutions:**
1. Lazy load each settings section independently
2. Remove unused settings code
3. Tree-shake form libraries

### Task 1.4: Remove Unused Dependencies
**Audit needed:**
```bash
npx depcheck
```
**Potential targets:**
- Duplicate utilities (lodash vs native)
- Dev dependencies in production bundle
- Unused icon sets

---

## Phase 2: Load Time Optimization (P1)

### Task 2.1: Critical CSS Extraction
**Goal:** Inline critical CSS, defer non-critical
**Tools:** `vite-plugin-critical` or manual extraction
**Impact:** Faster First Contentful Paint

### Task 2.2: Preload Key Assets
```html
<link rel="preload" href="/assets/vendor-react-*.js" as="script">
<link rel="preconnect" href="https://your-supabase-url.supabase.co">
<link rel="preconnect" href="https://fonts.googleapis.com">
```

### Task 2.3: Image Optimization
- Convert PNG/JPG to WebP
- Lazy load below-the-fold images
- Use appropriate image sizes

### Task 2.4: Font Optimization
**Current:** SF Mono, Fira Code, Consolas
**Optimize:**
- Subset fonts to used characters
- Use `font-display: swap`
- Consider system font stack

---

## Phase 3: Runtime Performance (P1)

### Task 3.1: Memoization Audit
**Already done (per BUILD_PLAN):**
- SeverityBadge, TrendBadge, StatCard, TimeAgo

**Needs review:**
- [ ] Large list components (ThreatActorsList, IncidentsList)
- [ ] Filter components that re-render frequently
- [ ] Chart components with complex data

### Task 3.2: Virtualization for Long Lists
**Problem:** Pages like IOCs can have 1000+ items
**Solution:** Use `react-window` or `@tanstack/virtual`
```javascript
import { FixedSizeList } from 'react-window'

<FixedSizeList
  height={600}
  itemCount={items.length}
  itemSize={50}
>
  {({ index, style }) => <Row data={items[index]} style={style} />}
</FixedSizeList>
```

### Task 3.3: Debounce/Throttle User Inputs
**Already done:** `useSearchFilter` with debounce
**Verify:**
- Filter dropdowns
- Infinite scroll triggers
- Real-time search

### Task 3.4: Web Worker for Heavy Computations
**Candidates:**
- STIX export generation
- Large dataset sorting/filtering
- Chart data transformation

---

## Phase 4: Network Optimization (P2)

### Task 4.1: API Response Caching
**Current:** Some caching via React Query (if used)
**Improve:**
- HTTP cache headers on API routes
- Service Worker caching for static data
- IndexedDB for offline support

### Task 4.2: Pagination Optimization
**Current:** Default 25 items per page
**Verify:**
- Cursor-based pagination for large datasets
- No over-fetching (select only needed fields)

### Task 4.3: Request Batching
**Opportunity:** Dashboard makes multiple parallel requests
**Solution:** Combine into single batch endpoint or use DataLoader pattern

---

## Phase 5: Build Optimization (P2)

### Task 5.1: Vite Configuration Tuning
```javascript
// vite.config.js
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-charts': ['recharts', 'd3-scale', 'd3-shape'],
          'vendor-utils': ['date-fns', 'lodash-es'],
        }
      }
    },
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      }
    }
  }
})
```

### Task 5.2: Analyze Bundle Contents
```bash
npm install -D rollup-plugin-visualizer
# Add to vite.config.js, then run:
npm run build -- --analyze
```

### Task 5.3: Tree Shaking Verification
- Ensure all imports are ES modules
- Check for side-effect imports blocking tree shaking
- Mark pure functions for better dead code elimination

---

## Implementation Priority

| Task | Priority | Effort | Impact |
|------|----------|--------|--------|
| Chart library optimization | P0 | High | -200 KB |
| Main bundle code splitting | P0 | Medium | -150 KB |
| Settings lazy loading | P1 | Low | -50 KB |
| Remove unused deps | P1 | Low | -50 KB |
| List virtualization | P1 | Medium | Better UX |
| Critical CSS | P2 | Medium | Faster FCP |
| API caching | P2 | Medium | Faster loads |
| Build config tuning | P2 | Low | -50 KB |

---

## Measurement & Monitoring

### Tools
- **Lighthouse CI:** Automated performance scoring
- **Bundle Analyzer:** Track bundle size changes
- **Web Vitals:** Real user metrics

### Key Metrics to Track
```javascript
// Add to src/lib/analytics.js
export function trackWebVitals() {
  import('web-vitals').then(({ onCLS, onFID, onLCP, onFCP, onTTFB }) => {
    onCLS(sendToAnalytics)
    onFID(sendToAnalytics)
    onLCP(sendToAnalytics)
    onFCP(sendToAnalytics)
    onTTFB(sendToAnalytics)
  })
}
```

### CI Integration
```yaml
# .github/workflows/lighthouse.yml
- name: Run Lighthouse
  uses: treosh/lighthouse-ci-action@v10
  with:
    urls: |
      https://vigil.theintelligence.company/
      https://vigil.theintelligence.company/actors
    budgetPath: ./lighthouse-budget.json
```

---

## Quick Wins Checklist

- [ ] Enable gzip/brotli compression (verify Vercel config)
- [ ] Add `loading="lazy"` to images
- [ ] Remove `console.log` in production
- [ ] Verify no duplicate React instances
- [ ] Check for source maps in production (disable if not needed)

---

*Last Updated: January 17, 2026*
