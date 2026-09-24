/**
 * What a regulator has told financial institutions to look for.
 *
 * Every other source in Vigil records what happened. This one records what
 * institutions are instructed to watch for, and FinCEN is the only body here
 * whose output is written to be acted on under a legal obligation.
 *
 * ## This is the register, not the indicators
 *
 * The red flags are inside the PDFs. Turning a paragraph of prose into a
 * structured indicator is a judgment, and a regular expression making it is how
 * two false attributions reached this database. So every row carries
 * `indicators_read = false`, and `review_regulatory_advisories()` queues the
 * fraud-relevant documents for a person.
 *
 * **There is deliberately no method here that returns red flags, indicators or
 * a typology.** Vigil does not hold any. A test asserts that absence, because
 * the obvious next commit is the one that invents them.
 *
 * ## Two things a caller must not do
 *
 * Do not present a rescinded advisory as withdrawn from history. Nine of these
 * were rescinded; all nine were issued, and institutions acted on them. They
 * are kept for that reason and the page marks them rather than hiding them.
 *
 * Do not treat `language = 'es'` as a separate document. FinCEN republishes
 * some alerts in Spanish under the same identifier and a different date, which
 * is why language is part of the key and not a flag.
 */

import { supabase } from './client'

/** What each kind of document is for, in FinCEN's own terms. */
export const ADVISORY_KINDS = {
  alert: {
    label: 'Alert',
    note: 'Issued on an emerging threat, usually with red-flag indicators attached.',
  },
  advisory: {
    label: 'Advisory',
    note: 'The main series. Typology plus indicators, aimed at AML monitoring.',
  },
  notice: { label: 'Notice', note: 'Procedural or regulatory, addressed to filers.' },
  bulletin: { label: 'Bulletin', note: 'Shorter guidance, often on a single filing question.' },
  fact_sheet: { label: 'Fact sheet', note: 'Explanatory material rather than instruction.' },
}

/** The registers Vigil reads. One so far; the table is not FinCEN-shaped. */
export const ADVISORY_SOURCES = {
  fincen: {
    label: 'FinCEN',
    authority: 'Financial Crimes Enforcement Network, US Treasury',
    licence: 'US public domain',
  },
}

const LIST_COLUMNS = `
  id, source, advisory_id, language, kind, title, published,
  url, document_url, rescinded, rescinded_note, indicators_read
`

export const advisoryRegister = {
  /**
   * A page of documents, newest first.
   *
   * Rescinded documents are included by default. They were issued and acted
   * on, and a register that quietly drops them is a register that rewrites
   * what an institution was told.
   */
  async getAll({
    source = null,
    kind = null,
    search = null,
    includeRescinded = true,
    limit = 50,
    offset = 0,
  } = {}) {
    let query = supabase
      .from('regulatory_advisories')
      .select(LIST_COLUMNS, { count: 'exact' })
      .order('published', { ascending: false, nullsFirst: false })
      .order('advisory_id', { ascending: false })
      .range(offset, offset + limit - 1)

    if (source) query = query.eq('source', source)
    if (kind) query = query.eq('kind', kind)
    if (!includeRescinded) query = query.eq('rescinded', false)
    if (search) query = query.or(`title.ilike.%${search}%,advisory_id.ilike.%${search}%`)

    const { data, count, error } = await query
    return { data, count: typeof count === 'number' ? count : null, error }
  },

  /**
   * How many documents of each kind, counted by the database.
   *
   * Counting client-side hits PostgREST's 1,000-row cap. This repository has
   * shipped that defect once: a page reported 1,000 filings against 8,896 and
   * published the shortfall as a fact.
   */
  async countsByKind() {
    const entries = await Promise.all(
      Object.keys(ADVISORY_KINDS).map(async (kind) => {
        const { count, error } = await supabase
          .from('regulatory_advisories')
          .select('id', { count: 'exact', head: true })
          .eq('kind', kind)

        return { kind, documents: error ? null : count, error }
      })
    )

    const failed = entries.find((e) => e.error)
    if (failed) return { data: null, error: failed.error }

    return {
      data: entries.filter((e) => e.documents > 0).sort((a, b) => b.documents - a.documents),
      error: null,
    }
  },

  /**
   * What the register holds, as database counts.
   *
   * `indicatorsRead` is the honest headline and it is zero. A count that failed
   * stays null and renders as an em dash; "0 documents read" and "we could not
   * read that count" are different claims.
   */
  async getCoverage() {
    const count = async (apply) => {
      const query = supabase
        .from('regulatory_advisories')
        .select('id', { count: 'exact', head: true })
      const { count: n, error } = await (apply ? apply(query) : query)
      return error ? null : n
    }

    const edge = async (ascending) => {
      const { data, error } = await supabase
        .from('regulatory_advisories')
        .select('published')
        .not('published', 'is', null)
        .order('published', { ascending })
        .limit(1)
        .maybeSingle()
      return error ? null : (data?.published ?? null)
    }

    const [documents, rescinded, indicatorsRead, spanish, undated, earliest, latest] =
      await Promise.all([
        count(),
        count((q) => q.eq('rescinded', true)),
        count((q) => q.eq('indicators_read', true)),
        count((q) => q.neq('language', 'en')),
        count((q) => q.is('published', null)),
        edge(true),
        edge(false),
      ])

    return {
      data: { documents, rescinded, indicatorsRead, spanish, undated, earliest, latest },
      error: null,
    }
  },

  /**
   * The documents a person has been asked to read, straight from the queue.
   *
   * Read from `data_quality_findings` rather than recomputed here, so the page
   * and the review queue cannot disagree about what is outstanding.
   *
   * ## Why this cross-checks before it returns a number
   *
   * `data_quality_findings` is readable by `authenticated` and not by `anon`
   * (migration 126). PostgREST answers an RLS-filtered read with an empty set
   * and `count: 0` — **not** an error, and not a denial a caller can detect.
   * Checked against the live API with the anon key, the Content-Range header
   * came back as a range of zero rows while 29 documents were queued.
   *
   * The page is behind auth so a real user reads the true figure, which is
   * worse rather than better: if that policy is ever narrowed the page starts
   * publishing "0 queued for a person to read" as a fact, and zero is a
   * plausible number in a way an error is not.
   *
   * So a zero is only believed when the register agrees there is nothing to
   * read. If the register holds unread documents and the queue reads empty,
   * the count is `null` — unknown — and the page renders an em dash. That is
   * the standing rule here: absence and zero are different answers.
   *
   * This asks the register only whether `indicators_read` is false. It does not
   * re-implement which documents are worth queueing; that predicate lives in
   * `review_regulatory_advisories()` and stays there.
   */
  async getQueuedForReading({ limit = 200 } = {}) {
    const [queue, unread] = await Promise.all([
      supabase
        .from('data_quality_findings')
        .select('subject, details, first_seen', { count: 'exact' })
        .eq('check_name', 'advisory_indicators_unread')
        .eq('status', 'open')
        .order('first_seen', { ascending: false })
        .limit(limit),
      supabase
        .from('regulatory_advisories')
        .select('id', { count: 'exact', head: true })
        .eq('indicators_read', false),
    ])

    const { data, count, error } = queue
    if (error) return { data: null, count: null, error }

    const readable = count !== 0 || unread.error !== null || unread.count === 0

    return {
      data,
      count: readable && typeof count === 'number' ? count : null,
      error: null,
    }
  },
}
