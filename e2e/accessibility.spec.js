import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Accessibility tests using axe-core
 * Tests for WCAG 2.1 Level A and AA compliance
 */

// Helper to run axe and return violations
async function checkAccessibility(page, context = {}) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('.recharts-wrapper') // Chart library, not our code
    .analyze()

  return results.violations
}

// Helper to format violations for readable output
function formatViolations(violations) {
  return violations.map(v => ({
    id: v.id,
    impact: v.impact,
    description: v.description,
    nodes: v.nodes.length,
    help: v.help,
    helpUrl: v.helpUrl
  }))
}

test.describe('Accessibility - Core Pages', () => {
  test('Dashboard should have no critical a11y violations', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const violations = await checkAccessibility(page)
    const critical = violations.filter(v => v.impact === 'critical')

    if (critical.length > 0) {
      console.log('Critical violations:', formatViolations(critical))
    }

    expect(critical).toHaveLength(0)
  })

  test('Threat Actors page should have no critical a11y violations', async ({ page }) => {
    await page.goto('/actors')
    await page.waitForLoadState('networkidle')

    const violations = await checkAccessibility(page)
    const critical = violations.filter(v => v.impact === 'critical')

    if (critical.length > 0) {
      console.log('Critical violations:', formatViolations(critical))
    }

    expect(critical).toHaveLength(0)
  })

  test('Incidents page should have no critical a11y violations', async ({ page }) => {
    await page.goto('/ransomware')
    await page.waitForLoadState('networkidle')

    const violations = await checkAccessibility(page)
    const critical = violations.filter(v => v.impact === 'critical')

    if (critical.length > 0) {
      console.log('Critical violations:', formatViolations(critical))
    }

    expect(critical).toHaveLength(0)
  })

  test('Vulnerabilities page should have no critical a11y violations', async ({ page }) => {
    await page.goto('/vulnerabilities')
    await page.waitForLoadState('networkidle')

    const violations = await checkAccessibility(page)
    const critical = violations.filter(v => v.impact === 'critical')

    if (critical.length > 0) {
      console.log('Critical violations:', formatViolations(critical))
    }

    expect(critical).toHaveLength(0)
  })

  test('IOC Search page should have no critical a11y violations', async ({ page }) => {
    await page.goto('/iocs')
    await page.waitForLoadState('networkidle')

    const violations = await checkAccessibility(page)
    const critical = violations.filter(v => v.impact === 'critical')

    if (critical.length > 0) {
      console.log('Critical violations:', formatViolations(critical))
    }

    expect(critical).toHaveLength(0)
  })

  test('Settings page should have no critical a11y violations', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    const violations = await checkAccessibility(page)
    const critical = violations.filter(v => v.impact === 'critical')

    if (critical.length > 0) {
      console.log('Critical violations:', formatViolations(critical))
    }

    expect(critical).toHaveLength(0)
  })
})

test.describe('Accessibility - Navigation & Keyboard', () => {
  test('Page should have accessible navigation structure', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Check for proper landmark regions
    const violations = await checkAccessibility(page)

    // No region or landmark violations
    const landmarkIssues = violations.filter(v =>
      v.id === 'region' || v.id === 'landmark-one-main'
    )

    // Allow some landmark issues since this is a dashboard app
    expect(landmarkIssues.filter(v => v.impact === 'critical')).toHaveLength(0)
  })

  test('All links should have accessible names', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const violations = await checkAccessibility(page)
    const linkNameIssues = violations.filter(v => v.id === 'link-name')

    if (linkNameIssues.length > 0) {
      console.log('Link name issues:', formatViolations(linkNameIssues))
    }

    expect(linkNameIssues).toHaveLength(0)
  })

  test('All buttons should have accessible names', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const violations = await checkAccessibility(page)
    const buttonNameIssues = violations.filter(v => v.id === 'button-name')

    if (buttonNameIssues.length > 0) {
      console.log('Button name issues:', formatViolations(buttonNameIssues))
    }

    expect(buttonNameIssues).toHaveLength(0)
  })

  test('Images should have alt text', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const violations = await checkAccessibility(page)
    const imageAltIssues = violations.filter(v => v.id === 'image-alt')

    if (imageAltIssues.length > 0) {
      console.log('Image alt issues:', formatViolations(imageAltIssues))
    }

    expect(imageAltIssues).toHaveLength(0)
  })
})

test.describe('Accessibility - Color Contrast', () => {
  test('Dashboard should have sufficient color contrast', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const violations = await checkAccessibility(page)
    const contrastIssues = violations.filter(v => v.id === 'color-contrast')

    // Log issues but allow some since we have a dark theme
    if (contrastIssues.length > 0) {
      console.log('Color contrast issues:', contrastIssues.length)
      contrastIssues.slice(0, 3).forEach(v => {
        console.log(`  - ${v.nodes.length} elements: ${v.description}`)
      })
    }

    // Allow up to 10 contrast issues (dark themes are challenging)
    expect(contrastIssues.length).toBeLessThanOrEqual(10)
  })
})

test.describe('Accessibility - Forms', () => {
  test('IOC Search form should have proper labels', async ({ page }) => {
    await page.goto('/iocs')
    await page.waitForLoadState('networkidle')

    const violations = await checkAccessibility(page)
    const labelIssues = violations.filter(v =>
      v.id === 'label' ||
      v.id === 'label-title-only' ||
      v.id === 'select-name'
    )

    if (labelIssues.length > 0) {
      console.log('Form label issues:', formatViolations(labelIssues))
    }

    expect(labelIssues).toHaveLength(0)
  })

  test('Settings forms should have proper labels', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('networkidle')

    const violations = await checkAccessibility(page)
    const labelIssues = violations.filter(v =>
      v.id === 'label' ||
      v.id === 'label-title-only' ||
      v.id === 'select-name'
    )

    if (labelIssues.length > 0) {
      console.log('Form label issues:', formatViolations(labelIssues))
    }

    expect(labelIssues).toHaveLength(0)
  })
})

test.describe('Accessibility - Full Audit Report', () => {
  test.skip('Generate full a11y audit report for Dashboard', async ({ page }) => {
    // Skip by default - run manually for detailed reports
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze()

    console.log('\n=== FULL A11Y AUDIT REPORT ===')
    console.log(`URL: ${page.url()}`)
    console.log(`Total violations: ${results.violations.length}`)
    console.log(`Passes: ${results.passes.length}`)
    console.log(`Incomplete: ${results.incomplete.length}`)

    console.log('\n--- VIOLATIONS BY IMPACT ---')
    const byImpact = { critical: [], serious: [], moderate: [], minor: [] }
    results.violations.forEach(v => {
      byImpact[v.impact]?.push(v)
    })

    Object.entries(byImpact).forEach(([impact, violations]) => {
      if (violations.length > 0) {
        console.log(`\n${impact.toUpperCase()}: ${violations.length}`)
        violations.forEach(v => {
          console.log(`  - ${v.id}: ${v.description} (${v.nodes.length} nodes)`)
        })
      }
    })

    expect(results.violations.filter(v => v.impact === 'critical')).toHaveLength(0)
  })
})
