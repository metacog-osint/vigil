// No personal name in the repository's own files, apart from copyright lines.
// LICENSE and NOTICE carry the copyright holder; doctrine/kit/ and tools/tic_archive.py are shared copies kept
// identical to their source repositories; package-lock.json is generated (its integrity hashes are base64).
import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const SKIP = ['doctrine/kit/', 'tools/tic_archive.py', 'package-lock.json', 'LICENSE', 'NOTICE']
// Lower-case words, by SHA-256, so this file does not hold them.
const WORDS = new Set([
  'e1608f75c5d7813f3d4031cb30bfb786507d98137538ff8e128a6ff74e84e643',
  '1e79f6794931ef59a7825ea40e5b00346d48e7b6a9ada0904a3b9738b2baca92',
])
// Lines left on purpose, per file: one migration's stored SQL text (an applied migration's SQL never changes) and a
// worked example's source citation, the author's name on a cited work. A file may hold fewer, never more, and a
// file not listed holds none.
const PENDING = {
  'src/pages/__tests__/ContestedClaims.test.jsx': 1,
  'supabase/migrations/146_contested_claims_worked_examples.sql': 3,
  'supabase/migrations/174_wa_breach_causes.sql': 1,
}

const sha = (w) => createHash('sha256').update(w.toLowerCase()).digest('hex')

export function hits(text) {
  const found = []
  text.split(/\r?\n/).forEach((line, i) => {
    if (line.startsWith('Copyright ')) return
    const spaced = line.replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2')
    const words = spaced.match(/\p{L}+/gu) || []
    if (words.some((w) => WORDS.has(sha(w)))) found.push(i + 1)
  })
  return found
}

describe('no personal names', () => {
  it('detects a listed word as a whole word and skips copyright lines', () => {
    const word = ['T', 'om'].join('')
    expect(hits(`a\nset by ${word}'s rule\nby${word} x\nCopyright 2026 ${word}`)).toEqual([2, 3])
    expect(hits('atom bottom custom')).toEqual([])
    expect(hits(`São ${word}é and Príncipe`)).toEqual([])
  })

  it("the repository's tracked files hold none beyond the pending lines", () => {
    const listed = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT })
      .toString('utf8')
      .split('\0')
    const bad = []
    for (const name of listed) {
      if (!name || SKIP.some((s) => name.startsWith(s))) continue
      const full = path.join(ROOT, name)
      let data
      try {
        data = readFileSync(full) // a directory (a submodule) or a deleted file throws
      } catch {
        continue
      }
      if (data.includes(0)) continue
      const n = hits(data.toString('utf8'))
      if (n.length > (PENDING[name] || 0)) bad.push(`${name}:${n.join(',')}`)
    }
    expect(bad).toEqual([])
  }, 120000) // reads every tracked file
})
