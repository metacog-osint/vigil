/**
 * Reading the HHS Office for Civil Rights breach portal (192).
 *
 * The portal (ocrportal.hhs.gov/ocr/breach) is a JavaServer Faces application:
 * no API, no per-report page, and every list reached by posting the form back
 * with its view state. What it does offer is a CSV export of each list, and
 * the CSV carries every field the table shows, plus OCR's Web Description.
 *
 * Free of Deno imports: the hhs-ocr-breaches Edge Function loads it at run
 * time, vitest under Node at test time.
 *
 * Nothing here reads meaning into a field. "Hacking/IT Incident" is HHS's
 * category and stays one; a description that says "ransomware" is OCR's words
 * and stays in them.
 */

export const HHS_ORIGIN = 'https://ocrportal.hhs.gov'
export const HHS_FRONT = `${HHS_ORIGIN}/ocr/breach/breach_frontpage.jsf`
export const HHS_REPORT = `${HHS_ORIGIN}/ocr/breach/breach_report_hip.jsf`
/** Where a reader is sent: the portal's own entry to the HIPAA lists. */
export const HHS_PUBLIC_URL = `${HHS_ORIGIN}/ocr/breach/breach_report.jsf`

export type HhsStatus = 'under_investigation' | 'archived'

export interface HhsReport {
  accession: string
  company_name: string
  entity_state: string | null
  entity_type: string | null
  persons_affected: number | null
  submitted: string
  breach_type: string | null
  locations: string[] | null
  business_associate: boolean | null
  description: string | null
  status: HhsStatus
  url: string
}

/**
 * The export's header, by position. Two of OCR's headers are broken - the
 * first and eighth print a Java object ("javax.faces.component.UIPanel@5e239d0")
 * instead of "Name of Covered Entity" and "Business Associate Present" - so
 * those two are checked only for being there. The rest must read exactly this,
 * and a CSV whose columns moved is refused rather than read into the wrong
 * fields.
 */
export const EXPECTED_HEADER: (string | null)[] = [
  null,
  'State',
  'Covered Entity Type',
  'Individuals Affected',
  'Breach Submission Date',
  'Type of Breach',
  'Location of Breached Information',
  null,
  'Web Description',
]

/** RFC 4180: quoted fields, doubled quotes, newlines inside quotes (OCR's descriptions have them). */
export function parseCsv(text: string): string[][] {
  // Slices rather than appending a character at a time: the archive is 5.5 MB
  // and an Edge Function has about 2 s of CPU.
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  const delim = /[,\r\n]/g
  let row: string[] = []
  let i = 0

  while (i <= s.length) {
    let field: string
    if (s[i] === '"') {
      let out = ''
      let from = i + 1
      for (;;) {
        const q = s.indexOf('"', from)
        if (q === -1) throw new Error('unterminated quoted field in HHS export')
        out += s.slice(from, q)
        if (s[q + 1] === '"') {
          out += '"'
          from = q + 2
          continue
        }
        i = q + 1
        break
      }
      field = out
    } else {
      delim.lastIndex = i
      const m = delim.exec(s)
      const end = m ? m.index : s.length
      field = s.slice(i, end)
      i = end
    }
    row.push(field)

    const c = s[i]
    if (c === ',') {
      i++
      continue
    }
    rows.push(row)
    row = []
    if (c === '\r') i += s[i + 1] === '\n' ? 2 : 1
    else if (c === '\n') i++
    else break // end of text
    if (i === s.length) break
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}

export function checkHeader(header: string[]): void {
  if (header.length !== EXPECTED_HEADER.length) {
    throw new Error(`HHS export has ${header.length} columns, expected ${EXPECTED_HEADER.length}`)
  }
  EXPECTED_HEADER.forEach((want, i) => {
    const got = (header[i] ?? '').trim()
    if (want === null ? got === '' : got !== want) {
      throw new Error(`HHS export column ${i + 1} reads "${got}", expected "${want ?? 'a header'}"`)
    }
  })
}

/** "10/16/2026" to "2026-10-16", or null. Exactly MM/DD/YYYY, as OCR writes it. */
export function hhsDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const iso = `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  const d = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso
}

function count(raw: string): number | null {
  const digits = raw.replace(/[,\s]/g, '')
  if (!/^\d+$/.test(digits)) return null
  const n = Number(digits)
  return Number.isSafeInteger(n) ? n : null
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Letters and digits, lowercased: actor_key's reading, so a name's spacing never splits a report. */
export function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

type Unkeyed = Omit<HhsReport, 'accession'>

/** One list's CSV, as reports without an accession yet. Rows with no name or no date are counted, not kept. */
export function readHhsCsv(
  text: string,
  status: HhsStatus
): { reports: Unkeyed[]; skipped: number } {
  const rows = parseCsv(text)
  if (rows.length === 0) throw new Error('HHS export was empty')
  checkHeader(rows[0])

  const reports: Unkeyed[] = []
  let skipped = 0
  for (const r of rows.slice(1)) {
    const name = clean(r[0] ?? '')
    const submitted = hhsDate(r[4] ?? '')
    if (!name || !submitted) {
      skipped++
      continue
    }
    const ba = clean(r[7] ?? '').toLowerCase()
    const locations = clean(r[6] ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
    // 151 archive descriptions use \r\n inside the text, the rest \n.
    const description = (r[8] ?? '').replace(/\r\n?/g, '\n').trim()
    reports.push({
      company_name: name,
      entity_state: clean(r[1] ?? '').toUpperCase() || null,
      entity_type: clean(r[2] ?? '') || null,
      persons_affected: count(r[3] ?? ''),
      submitted,
      breach_type: clean(r[5] ?? '') || null,
      locations: locations.length ? locations : null,
      business_associate: ba === 'yes' ? true : ba === 'no' ? false : null,
      description: description || null,
      status,
      url: HHS_PUBLIC_URL,
    })
  }
  return { reports, skipped }
}

/**
 * Gives every report its accession, over both lists at once.
 *
 * HHS publishes no report number. Name, state and submission date identify a
 * report except where one filer sent several the same day (49 groups on
 * 19 Nov 2026, the largest 13), so the last part is the report's place in its group,
 * ordered by fields that do not change when OCR closes a case. Run over both
 * lists together so a report moving to the archive keeps its accession.
 */
export function assignAccessions(reports: Unkeyed[]): HhsReport[] {
  const groups = new Map<string, Unkeyed[]>()
  for (const r of reports) {
    const base = `hhs-ocr:${nameKey(r.company_name)}:${r.entity_state ?? 'na'}:${r.submitted}`
    const g = groups.get(base)
    if (g) g.push(r)
    else groups.set(base, [r])
  }
  const sortKey = (r: Unkeyed) =>
    [
      r.entity_type ?? '',
      r.breach_type ?? '',
      (r.locations ?? []).join(','),
      r.business_associate === null ? '' : String(r.business_associate),
      String(r.persons_affected ?? '').padStart(12, '0'),
    ].join('\u0000')

  const out: HhsReport[] = []
  for (const [base, g] of groups) {
    const sorted = [...g].sort((a, b) =>
      sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0
    )
    sorted.forEach((r, i) => out.push({ ...r, accession: `${base}:${i + 1}` }))
  }
  return out
}

// ---- The form posts ------------------------------------------------------

/** The JSF view state in a full page or a partial (ajax) response. */
export function viewState(body: string): string | null {
  const full = body.match(/name="javax\.faces\.ViewState"[^>]*value="([^"]+)"/)
  if (full) return full[1]
  const partial = body.match(/ViewState:0"><!\[CDATA\[([^\]]+)\]\]>/)
  return partial ? partial[1] : null
}

/** The command link on the front page that opens the HIPAA lists. */
export function hipaaListLink(html: string): string | null {
  const re = /\{'(ocrForm:[A-Za-z0-9_:]+)':'\1'\}[^>]*>\s*View HIPAA Breach Reports/
  return html.match(re)?.[1] ?? null
}

/** The command link behind the "Export as CSV" icon. */
export function csvExportLink(html: string): string | null {
  const re = /\{'(ocrForm:[A-Za-z0-9_:]+)':'\1'\}[^>]*>\s*<img[^>]*alt="CSV"/
  return html.match(re)?.[1] ?? null
}

/** The tab view's id and the archive tab's id, for the ajax tab change. */
export function archiveTab(html: string): { view: string; tab: string } | null {
  const m = html.match(/href="#((ocrForm:[A-Za-z0-9_]+):archiveTab)"/)
  return m ? { view: m[2], tab: m[1] } : null
}

/** Cookies from a response's Set-Cookie headers, merged into a jar. */
export function mergeCookies(jar: Map<string, string>, setCookies: string[]): void {
  for (const c of setCookies) {
    const pair = c.split(';')[0]
    const eq = pair.indexOf('=')
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
  }
}

export function cookieHeader(jar: Map<string, string>): string {
  return [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
}

// ---- Reading both lists ----------------------------------------------

async function call(
  jar: Map<string, string>,
  ua: string,
  url: string,
  init: RequestInit = {},
  hops = 0
): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('User-Agent', ua)
  if (jar.size) headers.set('Cookie', cookieHeader(jar))
  const res = await fetch(url, { ...init, headers, redirect: 'manual' })
  mergeCookies(jar, res.headers.getSetCookie?.() ?? [])
  const location = res.headers.get('location')
  if (res.status >= 300 && res.status < 400 && location) {
    if (hops > 4) throw new Error(`too many redirects from ${url}`)
    await res.body?.cancel()
    return call(jar, ua, new URL(location, url).toString(), {}, hops + 1)
  }
  if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`)
  return res
}

function form(fields: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.append(k, v)
  return f
}

async function csv(res: Response, list: string): Promise<string> {
  const type = res.headers.get('content-type') ?? ''
  if (!type.includes('text/csv')) {
    throw new Error(`${list} export came back as ${type || 'no content type'}, not CSV`)
  }
  return await res.text()
}

/**
 * Both lists' CSV, read as a browser would (see the Edge Function's header).
 * Uses only fetch, so it runs in Deno and in Node alike.
 */
export async function readHhsLists(
  ua: string
): Promise<{ underInvestigation: string; archive: string }> {
  const jar = new Map<string, string>()
  const get = (url: string, init: RequestInit = {}) => call(jar, ua, url, init)
  const front = await (await get(HHS_FRONT)).text()
  const link = hipaaListLink(front)
  const vs0 = viewState(front)
  if (!link || !vs0)
    throw new Error('front page: no "View HIPAA Breach Reports" link or view state')

  const report = await (
    await get(HHS_FRONT, {
      method: 'POST',
      body: form({ ocrForm: 'ocrForm', [link]: link, 'javax.faces.ViewState': vs0 }),
    })
  ).text()
  const vs1 = viewState(report)
  const csvLink = csvExportLink(report)
  const tab = archiveTab(report)
  if (!vs1 || !csvLink || !tab)
    throw new Error('report page: no view state, CSV link or archive tab')

  const underInvestigation = await csv(
    await get(HHS_REPORT, {
      method: 'POST',
      body: form({ ocrForm: 'ocrForm', [csvLink]: csvLink, 'javax.faces.ViewState': vs1 }),
    }),
    'Under Investigation'
  )

  const partial = await (
    await get(HHS_REPORT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Faces-Request': 'partial/ajax',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: new URLSearchParams({
        'javax.faces.partial.ajax': 'true',
        'javax.faces.source': tab.view,
        'javax.faces.partial.execute': tab.view,
        'javax.faces.partial.render': 'ocrForm:breachReports ocrForm:results',
        'javax.faces.behavior.event': 'tabChange',
        'javax.faces.partial.event': 'tabChange',
        [`${tab.view}_newTab`]: tab.tab,
        [`${tab.view}_tabindex`]: '1',
        [`${tab.view}_activeIndex`]: '1',
        ocrForm: 'ocrForm',
        'javax.faces.ViewState': vs1,
      }),
    })
  ).text()
  const vs2 = viewState(partial) ?? vs1
  const archiveCsvLink = csvExportLink(partial) ?? csvLink
  if (!/archiveFilterPanel/.test(partial)) throw new Error('archive tab did not open')

  const archive = await csv(
    await get(HHS_REPORT, {
      method: 'POST',
      body: form({
        ocrForm: 'ocrForm',
        [archiveCsvLink]: archiveCsvLink,
        'javax.faces.ViewState': vs2,
      }),
    }),
    'Archive'
  )

  return { underInvestigation, archive }
}
