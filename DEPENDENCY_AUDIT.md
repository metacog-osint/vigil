# Dependency Audit

> Security vulnerabilities and update recommendations for project dependencies.
>
> **Created:** January 17, 2026
> **Last Audit:** January 17, 2026
> **Updated:** January 17, 2026
> **Related:** SECURITY_REMEDIATION_PLAN.md

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 0 | - |
| High | 1 | Pending (xlsx - no fix available) |
| Moderate | 2 | Pending (esbuild/vite) |
| Low | 0 | - |

### Completed Fixes
- **d3-color ReDoS** - Fixed via package.json override
- **undici vulnerabilities** - Fixed by upgrading Firebase to v12.8.0

---

## Vulnerabilities

### 1. d3-color - HIGH Severity - FIXED

**Advisory:** [GHSA-36jr-mh4h-2g58](https://github.com/advisories/GHSA-36jr-mh4h-2g58)
**Issue:** ReDoS (Regular Expression Denial of Service)
**Affected Versions:** < 3.1.0
**Status:** Fixed via package.json override to ^3.1.0

**Dependency Chain:**
```
react-simple-maps@3.x
└── d3-zoom@2.x
    └── d3-transition@2.x
        └── d3-color@2.x (vulnerable)
        └── d3-interpolate@2.x
            └── d3-color@2.x (vulnerable)
```

**Fix Options:**
1. **Option A (Breaking Change):** Downgrade react-simple-maps to v1.0.0
   ```bash
   npm audit fix --force
   ```
   ⚠️ This is a major version change - may break map functionality

2. **Option B (Recommended):** Wait for react-simple-maps update or use override
   ```json
   // package.json
   "overrides": {
     "d3-color": "^3.1.0"
   }
   ```
   ⚠️ Test thoroughly - may have compatibility issues

3. **Option C:** Replace react-simple-maps with alternative
   - Consider: `react-leaflet` or `mapbox-gl`

**Risk Assessment:** Medium - ReDoS requires malicious input to color parsing functions. User-provided color values are not used in the application.

---

### 2. undici - MODERATE Severity (Multiple CVEs) - FIXED

**Advisories:**
- [GHSA-c76h-2ccp-4975](https://github.com/advisories/GHSA-c76h-2ccp-4975) - Insufficiently Random Values
- [GHSA-cxrh-j4jr-qwg3](https://github.com/advisories/GHSA-cxrh-j4jr-qwg3) - DoS via bad certificate
- [GHSA-g9mf-h72j-4rw9](https://github.com/advisories/GHSA-g9mf-h72j-4rw9) - Unbounded decompression

**Affected Versions:** <= 6.22.0
**Status:** Fixed by upgrading Firebase from v10.14.1 to v12.8.0

**Previous Dependency Chain (now resolved):**
```
firebase@10.x -> firebase@12.8.0 (fixed)
```

---

### 3. esbuild - MODERATE Severity

**Advisory:** [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)
**Issue:** Development server CORS bypass
**Affected Versions:** <= 0.24.2

**Dependency Chain:**
```
vite@5.x - 6.1.x
└── esbuild@0.24.x (vulnerable)
```

**Fix Options:**
1. **Wait for Vite patch** (if using Vite 5.x)
2. **Upgrade to Vite 7.x** (breaking change)
   ```bash
   npm audit fix --force
   ```

**Risk Assessment:** Low - Only affects development server, not production builds. Attackers would need to lure developers to malicious websites while dev server is running.

---

### 4. xlsx - HIGH Severity - NO FIX AVAILABLE

**Advisories:**
- [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) - Prototype Pollution
- [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) - ReDoS

**Affected Versions:** All versions
**Status:** No fix available from upstream

**Usage in Vigil:**
- Dev dependency only (`scripts/ingest-umd-cyber-events.mjs`)
- Not included in production bundle
- Only processes trusted UMD data files

**Mitigation Options:**
1. Replace with `exceljs` or `@sheet/community`
2. Accept risk (dev-only, trusted input)
3. Isolate script execution

**Risk Assessment:** Low - Only used in data ingestion script for trusted Excel files. Not exposed to user input.

---

## Recommended Actions

### Completed

1. ~~**Update Firebase**~~ - DONE (v10.14.1 → v12.8.0)

2. ~~**Add d3-color override**~~ - DONE (package.json override to ^3.1.0)

### Remaining

3. **Evaluate Vite upgrade path** (Short-term)
   - Check Vite 7.x migration guide
   - Test in separate branch
   - Review breaking changes

4. **Consider xlsx alternatives** (Optional)
   - Replace with `exceljs` if security is a concern
   - Or accept risk since it's dev-only with trusted input

### Ongoing

5. **Enable Dependabot** (if not already)
   ```yaml
   # .github/dependabot.yml
   version: 2
   updates:
     - package-ecosystem: "npm"
       directory: "/"
       schedule:
         interval: "weekly"
       open-pull-requests-limit: 10
   ```

6. **Add npm audit to CI**
   ```yaml
   # .github/workflows/security.yml
   - name: Security audit
     run: npm audit --audit-level=high
   ```

---

## Full Audit Output

```bash
# Run to see current state
npm audit

# Fix what's safe to fix
npm audit fix

# See what --force would do (don't run blindly)
npm audit fix --dry-run --force
```

---

## Dependency Health Check

### Production Dependencies to Monitor

| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| firebase | 12.8.0 | 12.8.0 | Updated - undici fixed |
| @supabase/supabase-js | 2.39.0 | Check | Regular updates |
| react | 18.2.0 | 18.2.0 | Stable |
| recharts | 2.10.0 | Check | D3 dependency chain |
| react-simple-maps | 3.0.0 | 3.0.0 | d3-color fixed via override |
| vite | 5.0.0 | 7.x | Breaking changes - esbuild vuln |
| firebase-admin | 13.0.2 | 13.0.2 | NEW - for API endpoints |

### Useful Commands

```bash
# Check for outdated packages
npm outdated

# Check for unused dependencies
npx depcheck

# Check bundle impact of dependencies
npx bundle-phobia <package-name>
```

---

## Security Best Practices

1. **Lock file integrity** - Always commit `package-lock.json`
2. **Review before merge** - Check Dependabot PRs carefully
3. **Pin versions in CI** - Use exact versions for reproducibility
4. **Regular audits** - Run `npm audit` weekly or in CI

---

*Last Updated: January 17, 2026 (session 2)*
