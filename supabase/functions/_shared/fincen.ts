/**
 * Parsing FinCEN's register. Kept out of the Edge Function entry point so it
 * can be run outside Deno and checked against the live markup, which is the
 * only way to know a parser is right - a fetch returning HTTP 200 is not a
 * parser that read anything (THREAT_COVERAGE_GAPS section 1, the hard way).
 */
export const HOST = 'https://www.fincen.gov'
export const REGISTER = `${HOST}/resources/advisoriesbulletinsfact-sheets`
export const ARCHIVE = `${REGISTER}/advisories`
export const UA = 'Vigil Threat Intelligence metacog@theintelligence.company'
export const SOURCE = 'fincen'

/**
 * How many pages of the advisory archive to walk. Fifteen rows to a page, and
 * it ended at page 9 (2007) when measured on 24 September 2026. The cap is a
 * guard against an infinite pager, not a limit on the history - the walk stops
 * on the first empty page, so raising it costs nothing until FinCEN publishes
 * enough to need it.
 */
export const ARCHIVE_PAGES = 12

/**
 * How many archive pages a routine run walks.
 *
 * The full walk is eleven fetches and took 113 seconds against FinCEN on
 * 24 September 2026, which is close enough to the Edge Function wall clock that
 * a daily job would eventually trip over it. The archive is history: it changes
 * when FinCEN publishes an advisory, and that lands on page 0. So a routine run
 * reads the register and the first two archive pages, and the whole archive is
 * walked only when a caller asks for it.
 */
export const ARCHIVE_PAGES_SHALLOW = 2

export type Row = {
  advisory_id: string
  language: string
  kind: string
  title: string
  published: string | null
  url: string
  document_url: string | null
  rescinded: boolean
  rescinded_note: string | null
}

/** FinCEN's section headings, and the kind each one means. */
const SECTION_KINDS: Array<{ re: RegExp; kind: string }> = [
  { re: /^alerts$/i, kind: 'alert' },
  { re: /advisor/i, kind: 'advisory' },
  { re: /notice/i, kind: 'notice' },
  { re: /bulletin|fact sheet/i, kind: 'bulletin' },
]

export function kindForSection(heading: string): string | null {
  return SECTION_KINDS.find((s) => s.re.test(heading.trim()))?.kind ?? null
}

/**
 * Strip tags and decode the entities FinCEN's register actually uses.
 *
 * `&amp;` is decoded LAST, and that ordering is the whole point. Decoding it
 * first turns `&amp;lt;` into `&lt;`, which the next replacement then turns
 * into a `<` — a tag delimiter conjured out of text that never contained one.
 * CodeQL calls this double-unescaping and flagged it here as high severity,
 * correctly: the first version of this function decoded `&amp;` on line three,
 * and `&amp;lt;b&amp;gt;` came out as `<b>`.
 */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#8216;|&#8217;|‘|’/g, "'")
    .replace(/&#8220;|&#8221;|“|”/g, '"')
    // Last, so nothing it produces can be decoded a second time.
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function absolute(href: string): string {
  if (/^https?:/i.test(href)) return href
  return HOST + (href.startsWith('/') ? href : `/${href}`)
}

/** mm/dd/yyyy as FinCEN writes it, or an ISO datetime attribute. */
export function parseDate(cell: string): string | null {
  const iso = cell.match(/datetime="(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]

  const us = text(cell).match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (us) return `${us[3]}-${us[1]}-${us[2]}`
  return null
}

/**
 * A withdrawn item, which FinCEN marks in the description rather than by
 * removing the row. It was issued and institutions acted on it, so it is kept.
 */
export function readRescinded(description: string): { rescinded: boolean; note: string | null } {
  const m = description.match(/^\(\s*Rescinded[^)]*\)/i)
  return m ? { rescinded: true, note: m[0].replace(/^\(|\)$/g, '').trim() } : { rescinded: false, note: null }
}

/**
 * Spanish republications carry the same identifier as the English original and
 * a different date, so language is part of the key rather than a flag.
 */
export function languageOf(linkText: string, description: string): string {
  return /\bspanish\b/i.test(linkText) || /^aviso de fincen/i.test(linkText) || /^alerta de fincen/i.test(description)
    ? 'es'
    : 'en'
}

function cellsOf(row: string): string[] {
  return [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => m[1])
}

/** The main register: Alerts, Notices, Bulletins and Fact Sheets. */
export function parseRegister(html: string): Row[] {
  const out: Row[] = []
  const sections = html.split(/treas-section-heading--title">/).slice(1)

  for (const section of sections) {
    const heading = section.slice(0, section.indexOf('<'))
    const kind = kindForSection(heading)
    if (!kind) continue

    // Stop at the next heading so a section cannot swallow the one below it.
    const body = section.split(/treas-section-heading/)[0]

    for (const rowMatch of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = cellsOf(rowMatch[1])
      if (cells.length < 3) continue

      const linkText = text(cells[0])
      const id = linkText.match(/FIN-\d{4}-[A-Za-z]*\d+/)
      if (!id) continue

      const href = cells[0].match(/href="([^"]+)"/)
      const description = text(cells[2])
      const { rescinded, note } = readRescinded(description)

      // Alerts, notices and bulletins link straight to a PDF. The register's
      // short advisories section links to a landing page instead, and calling
      // that the document would be a claim about a file nobody has fetched.
      const linked = href ? absolute(href[1]) : null
      const documentUrl = linked && /\.pdf(\?|$)/i.test(linked) ? linked : null

      out.push({
        advisory_id: id[0],
        language: languageOf(linkText, description),
        // A fact sheet sits in the same table as the bulletins and only its
        // title says which it is.
        kind: kind === 'bulletin' && /fact sheet/i.test(description) ? 'fact_sheet' : kind,
        title: description.replace(/^\(\s*Rescinded[^)]*\)\s*/i, '') || linkText,
        published: parseDate(cells[1]),
        url: linked ?? REGISTER,
        document_url: documentUrl,
        rescinded,
        rescinded_note: note,
      })
    }
  }

  return out
}

/** The advisory archive: a Drupal view, linking to landing pages. */
export function parseArchive(html: string): Row[] {
  const out: Row[] = []

  for (const rowMatch of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = cellsOf(rowMatch[1])
    if (cells.length < 3) continue

    const linkText = text(cells[0])
    const id = linkText.match(/FIN-\d{4}-[A-Za-z]*\d+/i)
    if (!id) continue

    const href = cells[0].match(/href="([^"]+)"/)
    const description = text(cells[2])
    const { rescinded, note } = readRescinded(description)

    out.push({
      advisory_id: id[0].toUpperCase(),
      language: languageOf(linkText, description),
      kind: 'advisory',
      title: description.replace(/^\(\s*Rescinded[^)]*\)\s*/i, '') || linkText,
      published: parseDate(cells[1]),
      url: href ? absolute(href[1]) : ARCHIVE,
      // A landing page, not the document. Whether it carries a PDF is not
      // knowable without fetching it, and guessing a URL would publish a
      // dead link as a fact.
      document_url: null,
      rescinded,
      rescinded_note: note,
    })
  }

  return out
}

/** Later pages win: the archive's first page carries the current wording. */
export function dedupe(rows: Row[]): Row[] {
  const byKey = new Map<string, Row>()
  for (const row of rows) {
    const key = `${row.advisory_id}|${row.language}`
    if (!byKey.has(key)) byKey.set(key, row)
  }
  return [...byKey.values()]
}
