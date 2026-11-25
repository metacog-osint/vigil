/**
 * APP_SECTIONS must name the first segment of every signed-in route in
 * App.jsx, or a logged-out visitor on that page gets Not found instead of
 * the landing page.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { APP_SECTIONS, isAppSection } from '../appSections'

const app = readFileSync(resolve(process.cwd(), 'src/App.jsx'), 'utf8')
const start = app.indexOf('function ProtectedApp')
const protectedSrc = app.slice(start, app.indexOf('function AppContent', start))
// Public routes also exist in the signed-in layout, and the sign-in paths redirect there.
const NOT_SECTIONS = new Set(['', 'auth', 'login', 'register', 'sources'])

describe('APP_SECTIONS', () => {
  it('lists every signed-in route section', () => {
    expect(start).toBeGreaterThan(-1)
    const sections = new Set(
      [...protectedSrc.matchAll(/path="\/([^/"?]*)/g)]
        .map((m) => m[1])
        .filter((s) => !NOT_SECTIONS.has(s))
    )
    expect(sections.size).toBeGreaterThan(30)
    expect([...sections].filter((s) => !APP_SECTIONS.has(s))).toEqual([])
    expect([...APP_SECTIONS].filter((s) => !sections.has(s))).toEqual([])
  })

  it('matches on the first segment only', () => {
    expect(isAppSection('/actors')).toBe(true)
    expect(isAppSection('/actors/lockbit')).toBe(true)
    expect(isAppSection('/no-such-page')).toBe(false)
    expect(isAppSection('/')).toBe(false)
    expect(isAppSection('')).toBe(false)
  })
})
