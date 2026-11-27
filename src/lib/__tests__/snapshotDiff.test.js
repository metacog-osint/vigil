import { describe, it, expect } from 'vitest'
import { diffSnapshots, diffActorIds, nameActors } from '../snapshotDiff'
import { checkNarration } from '../snapshotNarration'

const snap = (name, body, extra = {}) => ({
  name,
  scope_type: 'sector',
  scope_value: 'healthcare',
  window_start: '2026-10-01',
  window_end: '2026-10-31',
  taken_at: '2026-11-01T00:00:00Z',
  body_version: 1,
  body,
  ...extra,
})

const before = snap('October', {
  claims: { total: 12, by_actor: { a: 9, b: 3 }, by_sector: { healthcare: 12 } },
  actors: ['a', 'b'],
  kev: ['CVE-2026-0001'],
  open_findings: 40,
  evidence_tiers: null,
})
const after = snap('November', {
  claims: { total: 17, by_actor: { a: 9, c: 8 }, by_sector: { healthcare: 17 } },
  actors: ['a', 'c'],
  kev: ['CVE-2026-0002'],
  open_findings: null,
  evidence_tiers: null,
})

describe('diffSnapshots', () => {
  const diff = diffSnapshots(before, after)

  it('lists added, removed and changed', () => {
    expect(diff.claims_total).toEqual({ before: 12, after: 17, change: 5 })
    expect(diff.actors).toEqual({ added: ['c'], removed: ['b'] })
    expect(diff.kev).toEqual({ added: ['CVE-2026-0002'], removed: ['CVE-2026-0001'] })
    expect(diff.by_actor.map((r) => [r.key, r.change])).toEqual([
      ['c', 8],
      ['b', -3],
    ])
    expect(diffActorIds(diff).sort()).toEqual(['b', 'c'])
  })

  it('never reads null as zero', () => {
    expect(diff.open_findings).toEqual({ before: 40, after: null, change: null })
    const empty = diffSnapshots(before, snap('Empty', { claims: null, actors: null, kev: null }))
    expect(empty.claims_total.change).toBeNull()
    expect(empty.by_actor.every((r) => r.after === null && r.change === null)).toBe(true)
    expect(empty.actors).toEqual({ added: null, removed: null })
  })

  it('refuses two scope types', () => {
    expect(() => diffSnapshots(before, snap('Actor', {}, { scope_type: 'actor' }))).toThrow(
      /cannot be compared/
    )
  })

  it('keeps ids out of what the summary is given', () => {
    const actorScope = { scope_type: 'actor', scope_value: 'some-id' }
    const named = nameActors(
      diffSnapshots({ ...before, ...actorScope }, { ...after, ...actorScope }),
      { b: 'qilin', c: 'Akira' }
    )
    expect(JSON.stringify(named)).not.toContain('some-id')
    expect(named.actors).toEqual({ added: ['Akira'], removed: ['qilin'] })
  })
})

describe('checkNarration', () => {
  const named = nameActors(diffSnapshots(before, after), { b: 'qilin', c: 'Akira' })
  const known = ['qilin', 'Akira', 'LockBit', 'pixelleaks', 'Play']
  const check = (text) => checkNarration(text, named, known)

  it('keeps sentences whose figures and names are in the diff', () => {
    const result = check(
      'Claims rose from 12 to 17, a change of 5. Akira was added with 8 claims and qilin was removed. CVE-2026-0002 is a new KEV entry.'
    )
    expect(result).toHaveLength(3)
    expect(result.filter((s) => !s.ok)).toEqual([])
  })

  it.each([
    ['an invented number', 'Claims rose to 99.'],
    ['a percentage', 'Claims rose 5%.'],
    ['a number word', 'Akira posted forty claims.'],
    ['another actor', 'LockBit was added.'],
    ['another actor in lower case', 'The group pixelleaks was added.'],
    ['an unknown name', 'Zorblax was added.'],
    ['another CVE', 'CVE-2020-1234 is new.'],
  ])('fails a sentence with %s', (_, text) => {
    const [sentence] = check(text)
    expect(sentence.ok).toBe(false)
    expect(sentence.reasons.length).toBeGreaterThan(0)
  })
})
