import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { titleForPath, ROUTE_TITLES } from '../routeTitles'

describe('titleForPath', () => {
  it('titles the dashboard and a section', () => {
    expect(titleForPath('/')).toBe('Dashboard | Vigil')
    expect(titleForPath('/vulnerabilities')).toBe('Vulnerabilities | Vigil')
  })

  it('ignores a trailing slash and uses the section title for an actor page', () => {
    expect(titleForPath('/vulnerabilities/')).toBe('Vulnerabilities | Vigil')
    expect(titleForPath('/actors/lockbit')).toBe('Threat actors | Vigil')
  })

  it('returns null for an unknown path so Not found keeps its own title', () => {
    expect(titleForPath('/no-such-page')).toBeNull()
  })

  it('has a title for every real route in App.jsx', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/App.jsx'), 'utf8')
    const paths = [...src.matchAll(/<Route\s+path="(\/[^"*:]*)"\s+element=\{\s*<(?!Navigate)/g)]
      .map((m) => m[1])
      .filter((p) => !['/auth', '/login', '/register', '/terms', '/privacy'].includes(p))
    expect(paths.length).toBeGreaterThan(30)
    for (const p of paths) expect(ROUTE_TITLES, p).toHaveProperty([p])
  })
})
