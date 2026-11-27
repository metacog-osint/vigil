/**
 * Checks a generated summary against the diff it was written from. Every number,
 * CVE id and actor name in a sentence must appear in the diff. A sentence that
 * fails is returned with its reasons, to be shown struck through.
 *
 * The check is strict: a capitalised word that is neither in the diff nor a
 * plain word of the summary fails too, so an invented name is not passed.
 * It checks that figures and names appear, not that the sentence uses them
 * correctly.
 */

const words = (text) => text.trim().split(/\s+/)

// Index is the value, for zero to twenty
const NUMBER_WORDS = words(`zero one two three four five six seven eight nine ten eleven twelve
  thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty
  seventy eighty ninety hundred thousand dozen`)

// Capitalised words a summary of a diff uses that are not names
const PLAIN_WORDS = new Set(
  words(`a across actor actors added after all also among an and appeared are as at before between
  both by catalog change changed changes cisa claim claimed claims compared count counts cve data
  database decreased during each entries entry fell fewer findings first for from group groups had
  has have however in increased into is it its kev kevs later leak less list meanwhile more new
  newly no none not number of on only open over overall period removed rose scope second sector
  sectors since site snapshot snapshots stayed than that the their there these they this those
  through to total unchanged up was were while window with within`)
)

const NUMBER = /\d[\d,]*(?:\.\d+)?%?/g
const CVE = /CVE-\d{4}-\d+/gi

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const whole = (name) => new RegExp(`(?<![\\p{L}\\p{N}])${escape(name)}(?![\\p{L}\\p{N}])`, 'giu')

function facts(diff) {
  const numbers = new Set()
  const strings = []
  const walk = (value) => {
    if (typeof value === 'number') numbers.add(Math.abs(value))
    else if (typeof value === 'string') strings.push(value)
    else if (Array.isArray(value)) {
      numbers.add(value.length)
      value.forEach(walk)
    } else if (value && typeof value === 'object') Object.values(value).forEach(walk)
  }
  walk(diff)
  return { numbers, strings }
}

export function splitSentences(text) {
  return String(text || '')
    .split(/(?<=[.!?])\s+(?=[\p{Lu}\p{N}"“])|\n+/u)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * @param {string} text - the generated summary
 * @param {object} diff - the diff with actor names in place of ids (nameActors)
 * @param {string[]} knownActors - every actor name Vigil holds
 */
export function checkNarration(text, diff, knownActors = []) {
  const { numbers, strings } = facts(diff)
  const inDiff = new Set(strings.map((s) => s.toLowerCase()))
  // Longest first, so a name is removed before a shorter name inside it
  const allowed = [...new Set(strings)].filter(Boolean).sort((x, y) => y.length - x.length)
  const others = knownActors.filter(
    (n) => n && n.length > 2 && !inDiff.has(n.toLowerCase()) && !PLAIN_WORDS.has(n.toLowerCase())
  )

  return splitSentences(text).map((sentence) => {
    const reasons = []
    let rest = sentence
    for (const s of allowed) rest = rest.replace(whole(s), ' ')

    const lowered = rest.toLowerCase()
    for (const name of others) {
      if (lowered.includes(name.toLowerCase()) && whole(name).test(rest)) {
        reasons.push(`${name} is not in the diff`)
        rest = rest.replace(whole(name), ' ')
      }
    }
    for (const cve of rest.match(CVE) || []) reasons.push(`${cve} is not in the diff`)
    rest = rest.replace(CVE, ' ')

    for (const raw of rest.match(NUMBER) || []) {
      const value = Number(raw.replace(/[,%]/g, ''))
      if (raw.endsWith('%') || !numbers.has(value)) reasons.push(`${raw} is not in the diff`)
    }
    rest = rest.replace(NUMBER, ' ')

    for (const word of rest.match(/\p{L}[\p{L}'’-]*/gu) || []) {
      const lower = word.toLowerCase()
      const value = NUMBER_WORDS.indexOf(lower)
      if (value >= 0) {
        if (value > 20 || !numbers.has(value)) {
          reasons.push(`"${word}" is not a figure in the diff`)
        }
      } else if (/\p{Lu}/u.test(word)) {
        const parts = lower.split(/[-'’]/).filter((p) => p && p !== 's')
        if (!parts.every((p) => PLAIN_WORDS.has(p))) reasons.push(`${word} is not in the diff`)
      }
    }
    return { text: sentence, ok: reasons.length === 0, reasons: [...new Set(reasons)] }
  })
}
