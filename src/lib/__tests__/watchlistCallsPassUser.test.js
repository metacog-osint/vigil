/**
 * Every call to the watchlists module from the app names the user.
 *
 * Row-level security decides whose watchlists a session can reach; the user id
 * the app passes only has to match it. A call that leaves the id out used to
 * query user_id = 'anonymous' and find nothing, or refuse to add, with no error
 * anyone saw: the watch star on the actor and incident tables did nothing. This
 * reads the source and fails on any call that stops short of its user-id
 * argument.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(__dirname, '../..')
const MODULE = path.join(SRC, 'lib', 'supabase', 'watchlists.js')

// The position of the user-id argument in each method of src/lib/supabase/watchlists.js
const USER_ARG = {
  getAll: 0,
  getById: 1,
  update: 2,
  delete: 1,
  addItem: 2,
  removeItem: 2,
  isWatched: 1,
  containing: 1,
}

const CALL = new RegExp(`\\bwatchlists(?:Api)?\\.(${Object.keys(USER_ARG).join('|')})\\(`, 'g')

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full)
    return /\.(js|jsx)$/.test(entry.name) && full !== MODULE ? [full] : []
  })
}

/** The top-level arguments of the call whose '(' is at `open`. */
function argumentsAt(text, open) {
  const args = []
  let depth = 0
  let quote = null
  let start = open + 1
  for (let i = open; i < text.length; i++) {
    const ch = text[i]
    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') quote = ch
    else if ('([{'.includes(ch)) depth++
    else if (')]}'.includes(ch)) {
      depth--
      if (depth === 0) {
        const last = text.slice(start, i).trim()
        if (last) args.push(last)
        return args
      }
    } else if (ch === ',' && depth === 1) {
      args.push(text.slice(start, i).trim())
      start = i + 1
    }
  }
  throw new Error('unclosed call')
}

function findCalls() {
  return sourceFiles(SRC).flatMap((file) => {
    const text = fs.readFileSync(file, 'utf8')
    return [...text.matchAll(CALL)].map((match) => ({
      where: `${path.relative(SRC, file)}: ${match[0]}`,
      method: match[1],
      args: argumentsAt(text, match.index + match[0].length - 1),
    }))
  })
}

describe('watchlists calls name the user', () => {
  const calls = findCalls()

  it('finds the app’s watchlist calls', () => {
    // WatchButton, ThreatActors, Incidents, Watchlists and watch packs
    expect(calls.length).toBeGreaterThanOrEqual(10)
  })

  it('every call passes its user-id argument', () => {
    const short = calls
      .filter((call) => call.args.length <= USER_ARG[call.method])
      .map((call) => call.where)
    expect(short).toEqual([])
  })

  it('watch controls use only the entity types the watchlists table allows', () => {
    // watchlists.entity_type CHECK in migration 004
    const allowed = ['actor', 'vulnerability', 'ioc', 'incident']
    const used = sourceFiles(SRC).flatMap((file) => {
      const text = fs.readFileSync(file, 'utf8')
      const found = [
        ...text.matchAll(/<WatchButton[^>]*\bentityType="([^"]+)"/g),
        ...text.matchAll(/\bw\.entity_type === '([^']+)'/g),
      ]
      return found.map((m) => ({ where: path.relative(SRC, file), type: m[1] }))
    })
    expect(used.length).toBeGreaterThanOrEqual(3)
    expect(used.filter((u) => !allowed.includes(u.type))).toEqual([])
  })

  it('the parser counts arguments', () => {
    expect(argumentsAt("f(a, { b: 1, c: [2, 3] }, 'x,y')", 1)).toEqual([
      'a',
      '{ b: 1, c: [2, 3] }',
      "'x,y'",
    ])
    expect(argumentsAt('f()', 1)).toEqual([])
  })
})
