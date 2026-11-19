/**
 * The feed registry: every scheduled job the worker knows how to run.
 *
 * Before this existed, each cron trigger ran a hard-coded list of feeds start to
 * finish. That put twenty feeds' worth of subrequests into one invocation, which
 * Workers Free cuts off at 50, so the later feeds in a list never ran and the run
 * died before recording that anything had happened.
 *
 * Now every trigger calls the same scheduler, which picks whichever jobs are most
 * overdue and runs as many as the subrequest budget allows. A feed's cadence is
 * declared here rather than by which cron it was listed under, and `feed_health`
 * (migration 101) holds the same intervals so freshness can be read from SQL.
 *
 * `id` is the feed's own source identifier, matching what it writes into the data
 * tables and what it now records in sync_log.
 */

// IOC feeds
import { ingestThreatFox } from './threatfox.js'
import { ingestURLhaus } from './urlhaus.js'
import { ingestFeodo } from './feodo.js'
import { ingestMalwareBazaar } from './malwarebazaar.js'
import { ingestPulsedive } from './pulsedive.js'
import { ingestTorExits } from './tor-exits.js'

// Vulnerability feeds
import { ingestCISAKEV } from './cisa-kev.js'
import { ingestNVD } from './nvd.js'
import { ingestEPSS } from './epss.js'
import { ingestCISAICS } from './cisa-ics.js'

// Ransomware and incidents
import { ingestRansomlook } from './ransomlook.js'
import { ingestRansomwhere } from './ransomwhere.js'
import { ingestRansomwareLive } from './ransomware-live.js'
import { ingestOFAC } from './ofac-sdn.js'
import { ingestThreatCluster } from './threatcluster.js'
import { ingestSecDisclosures } from './sec-disclosures.js'
import { ingestCisaAdvisories } from './cisa-advisories.js'
import { ingestNcscAdvisories } from './ncsc-advisories.js'
import { ingestEtdaActors } from './etda-actors.js'
import { ingestVendorResearch } from './vendor-research.js'
import { ingestStateBreachNotices } from './state-breach-notices.js'
import { ingestWaBreachCauses } from './wa-breach-causes.js'
import { ingestHhsOcrBreaches } from './hhs-ocr-breaches.js'
import { ingestCisaVulnrichment } from './cisa-vulnrichment.js'
import { ingestVendorExploited } from './vendor-exploited.js'
import { ingestCertfrAlerts } from './certfr-alerts.js'
import { ingestFincenAdvisories } from './fincen-advisories.js'
import { buildPublicSummary } from './public-summary.js'

// Threat actor databases
import { ingestMalpedia } from './malpedia.js'
import { ingestMISPGalaxy } from './misp-galaxy.js'
import { ingestMITRE } from './mitre.js'
import { ingestMitreAtlas } from './mitre-atlas.js'

// Network and malware intelligence
import { ingestBGPStream } from './bgpstream.js'
import { enrichCensys, CENSYS_BATCH } from './censys.js'
import { ingestAnyRun } from './anyrun.js'

/**
 * `cost` is roughly how many subrequests a job needs: one per page of a select, one
 * per upsert batch, one to record the run. It decides whether a job is worth
 * starting with the budget that remains, so a wrong number here is a scheduling
 * problem, not a correctness one - the budget is the hard stop, and a job
 * that runs out mid-way is recorded as budget_exhausted rather than taking the
 * invocation down with it.
 *
 * These come from what each feed does per run, not from how big its table is. The
 * hourly feeds are incremental: Ransomlook inserts the handful of posts it has not
 * seen, which is one or two batches, not a backfill.
 *
 * A number here can be measured rather than guessed: run the feed inside
 * withSubrequestBudget() with createSubrequestBudget({ limit: 10000, reserve: 0 })
 * and read budget.used afterwards (docs/INGESTION_HANDOVER.md, "Measuring a
 * feed's cost"). That is how nvd's was found to be 40 against a ceiling of 32 - a
 * feed that could never finish, quietly spending the tail of every run. Since the
 * fetch meter (17 Nov 2026) every call counts, the feed's own fetch() included, so
 * a cost measured before then may be low. On Workers Paid's ceiling of 1,000 that
 * no longer decides whether a job runs.
 */
const HOUR = 60
const DAY = 24 * HOUR
const WEEK = 7 * DAY

/**
 * `countNew` reads how many genuinely new records a run brought, for jobs that
 * report it under a name other than `added` (the scheduler's newRecordCount).
 * Every count read here is the number of rows the SQL writer behind the Edge
 * Function inserted (`'new', inserted` in 088/148, `advisories_new` in 131,
 * `filings_new` in 130, `reports_new` in 139, `'new', v_new` in 143,
 * `v_after - v_before` in 147), so it is a count of new rows, not of rows
 * written. A job with no countNew and no `added` logs records_added as null.
 */
const field = (name) => (result) => result[name]

/** One count per source in a group: the sum of those that report one, else null. */
const sumOver = (group, name) => (result) => {
  const parts = result[group]
  if (!parts || typeof parts !== 'object') return null
  const counts = Object.values(parts)
    .map((part) => part?.[name])
    .filter(Number.isFinite)
  return counts.length ? counts.reduce((a, b) => a + b, 0) : null
}

/**
 * priority 1 jobs are the ones Vigil's freshness claims rest on: leak-site claims
 * and the data-quality pass. They are offered a slot before anything else that is
 * also due, so a backlog of reference feeds can never starve them.
 */
export const JOBS = [
  // --- Leak sites and the checks that run against them ---
  {
    id: 'ransomlook',
    priority: 1,
    cost: 8,
    intervalMinutes: HOUR,
    run: (db, env) => ingestRansomlook(db, env),
  },
  {
    id: 'threatfox',
    priority: 1,
    cost: 6,
    intervalMinutes: HOUR,
    run: (db, env) => ingestThreatFox(db, env),
  },
  {
    id: 'data-quality',
    priority: 1,
    cost: 2,
    intervalMinutes: HOUR,
    run: (db) => rpc(db, 'run_data_quality_checks'),
  },
  // Queues leak-site posts that look like announcements rather than victim
  // claims. It has only ever run once, by hand, when migration 095 was
  // generalised; every post published since has gone unexamined. It only ever
  // queues a candidate and never moves a row, so running it hourly is safe.
  {
    id: 'leak-site-notices',
    priority: 2,
    cost: 2,
    intervalMinutes: HOUR,
    run: (db) => rpc(db, 'detect_leak_site_notices'),
  },
  {
    id: 'actor-status',
    priority: 1,
    cost: 2,
    intervalMinutes: HOUR,
    run: (db) => rpc(db, 'apply_actor_status'),
  },
  // One row per active actor per UTC day into actor_trend_history (181). It
  // replaces the GitHub script that wrote it with the anon key and stopped on
  // 30 May 2026. snapshot_actor_trends() is idempotent per day, so the hourly
  // scheduler may run it any number of times without adding rows.
  {
    id: 'actor-trend-snapshot',
    priority: 2,
    cost: 2,
    intervalMinutes: DAY,
    run: (db) => rpc(db, 'snapshot_actor_trends'),
  },
  {
    id: 'ioc-geo',
    priority: 1,
    cost: 2,
    intervalMinutes: HOUR,
    run: (db) => rpc(db, 'resolve_ioc_geo', { p_limit: 5000 }),
  },

  // --- Delivering what users asked to be told about ---
  // The window is wider than the cadence on purpose. Matching is deduplicated per
  // user and item (migration 104), so a run that covers ground an earlier run
  // already covered delivers nothing twice - which means a skipped hour heals
  // itself on the next run instead of leaving a gap in someone's alerts.
  {
    id: 'alert-rules',
    priority: 2,
    cost: 2,
    intervalMinutes: HOUR,
    run: (db) => rpc(db, 'evaluate_alert_rules', { p_since: '3 hours', p_max_matches: 5 }),
  },
  // The hub's daily line, stored with the time it was built (175). Hourly, so
  // built_at says whether the worker is running and data_as_of follows each
  // RansomLook run. Three reads as anon and one upsert.
  {
    id: 'public-summary',
    priority: 2,
    cost: 4,
    intervalMinutes: HOUR,
    run: (db, env) => buildPublicSummary(db, env),
  },

  // --- Vulnerabilities: what R1/R2 in the offshoot spec depend on ---
  {
    id: 'cisa-kev',
    priority: 2,
    // fetch + 8 batches of 250 + the reconcile call (180)
    cost: 11,
    intervalMinutes: 6 * HOUR,
    run: (db, env) => ingestCISAKEV(db, env),
  },
  // VulnCheck KEV was retired on 15 Nov 2026 (migration 164): its Service Terms
  // forbid making its data available for free, and Vigil is free and public.
  {
    id: 'nvd',
    priority: 3,
    cost: 12,
    intervalMinutes: 6 * HOUR,
    run: (db, env) => ingestNVD(db, env),
  },
  // CISA's SSVC exploitation judgments from Vulnrichment (migration 176). One
  // subrequest to the cisa-vulnrichment Edge Function, which reads only the
  // commits since its cursor. Kept apart from KEV: cisa_ssvc, not vulnerabilities.
  {
    id: 'cisa-vulnrichment',
    priority: 3,
    cost: 1,
    intervalMinutes: HOUR,
    run: (db, env) => ingestCisaVulnrichment(db, env),
  },
  // Android bulletins' and Mozilla advisories' own exploitation statements
  // (migration 187). One subrequest to the vendor-exploited Edge Function, which
  // reads the bulletin index pages, new and recent bulletins, and Mozilla's
  // advisories as one tarball. Kept apart from KEV: vendor_exploit_statements.
  {
    id: 'vendor-exploited',
    priority: 4,
    cost: 1,
    intervalMinutes: DAY,
    run: (db, env) => ingestVendorExploited(db, env),
  },
  // CERT-FR's alerts (migration 188), kept as CERT-FR's notices, never as an
  // exploitation claim. One subrequest to the certfr-alerts Edge Function,
  // which reads CERT-FR's list and the alerts it opened or revised.
  {
    id: 'certfr-alerts',
    priority: 4,
    cost: 1,
    intervalMinutes: DAY,
    run: (db, env) => ingestCertfrAlerts(db, env),
  },
  {
    id: 'epss',
    priority: 3,
    // One subrequest to the epss-scores Edge Function (migration 158). It was
    // 10, spent refreshing the same 40 CVEs a day.
    cost: 1,
    intervalMinutes: DAY,
    run: (db, env) => ingestEPSS(db, env),
  },
  {
    id: 'cisa-ics',
    priority: 3,
    cost: 6,
    intervalMinutes: DAY,
    run: (db, env) => ingestCISAICS(db, env),
  },

  // --- IOC feeds ---
  {
    id: 'malwarebazaar',
    priority: 3,
    cost: 8,
    intervalMinutes: 6 * HOUR,
    run: (db, env) => ingestMalwareBazaar(db, env),
  },
  {
    id: 'pulsedive',
    priority: 3,
    cost: 6,
    intervalMinutes: 6 * HOUR,
    run: (db, env) => ingestPulsedive(db, env),
  },
  {
    id: 'urlhaus',
    priority: 3,
    cost: 10,
    intervalMinutes: 6 * HOUR,
    run: (db, env) => ingestURLhaus(db, env),
  },
  {
    id: 'feodo',
    priority: 3,
    cost: 4,
    intervalMinutes: 6 * HOUR,
    run: (db, env) => ingestFeodo(db, env),
  },
  {
    id: 'tor-exits',
    priority: 4,
    cost: 6,
    intervalMinutes: DAY,
    run: (db, env) => ingestTorExits(db, env),
  },

  // --- Sanctions, payments and group profiles ---
  {
    id: 'ofac-sdn',
    priority: 2,
    cost: 1,
    intervalMinutes: DAY,
    // A run that finds the list unchanged since last time reports no `new`.
    countNew: (r) => (r.unchanged === true ? 0 : r.new),
    run: (db, env) => ingestOFAC(db, env),
  },
  {
    id: 'ransomware.live',
    priority: 3,
    // Measured 17 on every successful run in the 14 days to 16 Nov 2026. Declared
    // 12, the scheduler started it in ticks with 12 to 16 left and it failed
    // "subrequest budget exhausted" 5 times in those 14 days. A declared cost has
    // to cover the whole run, or the full-cost check in scheduler.js cannot work.
    cost: 20,
    intervalMinutes: DAY,
    run: (db, env) => ingestRansomwareLive(db, env),
  },
  {
    id: 'threatcluster',
    priority: 2,
    cost: 1,
    intervalMinutes: DAY,
    run: (db, env) => ingestThreatCluster(db, env),
  },
  {
    id: 'sec-edgar',
    priority: 3,
    cost: 1,
    intervalMinutes: DAY,
    countNew: field('filings_new'),
    run: (db, env) => ingestSecDisclosures(db, env),
  },
  {
    id: 'cisa-advisories',
    priority: 2,
    cost: 1,
    intervalMinutes: 6 * HOUR,
    countNew: field('advisories_new'),
    run: (db, env) => ingestCisaAdvisories(db, env),
  },
  {
    id: 'ncsc-advisories',
    priority: 2,
    cost: 1,
    intervalMinutes: 6 * HOUR,
    countNew: field('advisories_new'),
    run: (db, env) => ingestNcscAdvisories(db, env),
  },
  {
    // Daily. FinCEN published six alerts in the whole of 2026, so anything
    // more often is polling a static page; one subrequest, and the Edge
    // Function reads three HTML pages behind it.
    id: 'fincen-advisories',
    priority: 2,
    cost: 1,
    intervalMinutes: 24 * HOUR,
    countNew: field('new'),
    run: (db, env) => ingestFincenAdvisories(db, env),
  },
  {
    id: 'ransomwhere',
    // The only ransom-payment corpus Vigil holds, which is why feed_expectations
    // marks it critical (migration 152) - the live API died on 20 September and
    // nobody found out for fourteen days.
    priority: 3,
    // One subrequest to the Edge Function. It was 10 when the parse happened
    // here against the API that is now 502.
    cost: 1,
    // Weekly: the Zenodo deposit only changes when a new version is published,
    // and the function skips the 5.5 MB download when the version matches
    // feed_cursors. A daily run would re-import an identical file.
    intervalMinutes: 7 * DAY,
    run: (db, env) => ingestRansomwhere(db, env),
  },

  // --- Reference data ---
  {
    id: 'malpedia',
    priority: 4,
    // Measured 23 on every successful run in the 14 days to 16 Nov 2026; declared
    // 12, it failed on the subrequest budget 7 times. See ransomware.live.
    cost: 24,
    intervalMinutes: DAY,
    run: (db, env) => ingestMalpedia(db, env),
  },
  {
    id: 'misp-galaxy',
    priority: 4,
    // Measured 23 on every successful run in the 14 days to 16 Nov 2026; declared
    // 12, it failed on the subrequest budget 8 times. See ransomware.live.
    cost: 24,
    intervalMinutes: DAY,
    run: (db, env) => ingestMISPGalaxy(db, env),
  },
  {
    id: 'bgpstream',
    priority: 4,
    cost: 4,
    intervalMinutes: DAY,
    run: (db, env) => ingestBGPStream(db, env),
  },
  {
    id: 'anyrun-trends',
    priority: 4,
    cost: 4,
    intervalMinutes: DAY,
    run: (db, env) => ingestAnyRun(db, env),
  },
  {
    id: 'censys',
    priority: 4,
    // One select, then a lookup and an update per IP. See CENSYS_BATCH.
    cost: CENSYS_BATCH * 2 + 1,
    intervalMinutes: DAY,
    run: (db, env) => enrichCensys(db, env),
  },
  // Actor origin countries. Weekly because ETDA's own last-db-change was
  // 2025-08-16 - a daily fetch would be 365 requests to observe one edit.
  {
    id: 'etda-actors',
    priority: 4,
    cost: 6,
    intervalMinutes: WEEK,
    run: (db, env) => ingestEtdaActors(db, env),
  },
  // Eight vendor blogs in one Edge Function invocation. Never parses
  // attribution - it stores reports and queues the judgment. Six hourly
  // because these are blogs: a handful of posts a week between all eight.
  {
    id: 'vendor-research',
    priority: 3,
    cost: 8,
    intervalMinutes: 6 * HOUR,
    countNew: sumOver('feeds', 'reports_new'),
    run: (db, env) => ingestVendorResearch(db, env),
  },
  // California, Washington and Oregon AG breach registries in one Edge
  // Function. Reads the newest pages of each; the full backfill is a manual
  // call with {"backfill": true}.
  {
    id: 'state-breach-notices',
    priority: 2,
    cost: 10,
    intervalMinutes: DAY,
    countNew: sumOver('states', 'new'),
    run: (db, env) => ingestStateBreachNotices(db, env),
  },
  // Washington's own record of each notice's cause, from the Attorney General's
  // open dataset (migration 174). One subrequest to the wa-breach-causes Edge
  // Function; it updates causes on rows state-breach-notices wrote, so it adds
  // no records of its own.
  {
    id: 'wa-breach-causes',
    priority: 4,
    cost: 1,
    intervalMinutes: DAY,
    run: (db, env) => ingestWaBreachCauses(db, env),
  },
  // HHS OCR's breach portal, both lists, into victim_disclosures (migration
  // 192). One subrequest to the hhs-ocr-breaches Edge Function, which reads the
  // whole of both lists each run because OCR revises counts and closes cases.
  {
    id: 'hhs-ocr-breaches',
    priority: 3,
    cost: 1,
    intervalMinutes: DAY,
    countNew: field('new'),
    run: (db, env) => ingestHhsOcrBreaches(db, env),
  },
  {
    id: 'mitre',
    priority: 5,
    cost: 12,
    intervalMinutes: WEEK,
    run: (db, env) => ingestMITRE(db, env),
  },
  // Resolves campaigns.actor_id from the names MITRE publishes. MITRE runs
  // weekly and new campaigns appear a few times a year, but this is one RPC,
  // and left unscheduled a new campaign sits unreachable for months - which is
  // how all 56 came to have a null actor_id in the first place.
  {
    id: 'campaign-links',
    priority: 4,
    cost: 1,
    intervalMinutes: DAY,
    run: (db) => rpc(db, 'link_campaign_actors'),
  },
  {
    id: 'mitre-atlas',
    priority: 5,
    cost: 6,
    intervalMinutes: WEEK,
    run: (db, env) => ingestMitreAtlas(db, env),
  },
]

export const JOBS_BY_ID = Object.fromEntries(JOBS.map((job) => [job.id, job]))

/**
 * What the cron triggers offer the scheduler. A `paused` job is left out because
 * one that cannot succeed is always overdue and is offered budget on every tick.
 * It stays in JOBS_BY_ID, so GET /ingest/<id> can still run it by hand to check a
 * fix before unpausing.
 */
export const SCHEDULED_JOBS = JOBS.filter((job) => !job.paused)

/**
 * The database-side jobs return their counts in `data`. Normalizing them here
 * means the scheduler logs an RPC exactly as it logs a feed.
 */
async function rpc(db, functionName, params = {}) {
  const { data, error } = await db.rpc(functionName, params)
  if (error) return { success: false, error: error.message }
  return { success: true, ...(data && typeof data === 'object' ? data : { result: data }) }
}
