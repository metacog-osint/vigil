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
import { ingestVulnCheck } from './vulncheck.js'
import { ingestNVD } from './nvd.js'
import { ingestEPSS } from './epss.js'
import { ingestCISAICS } from './cisa-ics.js'

// Ransomware and incidents
import { ingestRansomlook } from './ransomlook.js'
import { ingestRansomwhere } from './ransomwhere.js'
import { ingestRansomwareLive } from './ransomware-live.js'
import { ingestOFAC } from './ofac-sdn.js'

// Threat actor databases
import { ingestMalpedia } from './malpedia.js'
import { ingestMISPGalaxy } from './misp-galaxy.js'
import { ingestMITRE } from './mitre.js'
import { ingestMitreAtlas } from './mitre-atlas.js'

// Network and malware intelligence
import { ingestBGPStream } from './bgpstream.js'
import { enrichCensys } from './censys.js'
import { ingestAnyRun } from './anyrun.js'

/**
 * `cost` is roughly how many subrequests a job needs: one per page of a select, one
 * per upsert batch, one to record the run. It decides whether a job is worth
 * starting with the budget that remains, so a wrong number here is a scheduling
 * problem, not a correctness one - the client's budget is the hard stop, and a job
 * that runs out mid-way is recorded as budget_exhausted rather than taking the
 * invocation down with it.
 *
 * These come from what each feed does per run, not from how big its table is. The
 * hourly feeds are incremental: Ransomlook inserts the handful of posts it has not
 * seen, which is one or two batches, not a backfill.
 *
 * A number here can be measured rather than guessed: run the feed with a client
 * built on createSubrequestBudget({ limit: 10000, reserve: 0 }) and read
 * budget.used afterwards. That is how nvd's was found to be 40 against a ceiling
 * of 32 - a feed that could never finish, quietly spending the tail of every run.
 */
const HOUR = 60
const DAY = 24 * HOUR
const WEEK = 7 * DAY

/**
 * priority 1 jobs are the ones Vigil's freshness claims rest on: leak-site claims
 * and the data-quality pass. They are offered a slot before anything else that is
 * also due, so a backlog of reference feeds can never starve them.
 */
export const JOBS = [
  // --- Leak sites and the checks that run against them ---
  { id: 'ransomlook', priority: 1, cost: 8, intervalMinutes: HOUR, run: (db, env) => ingestRansomlook(db, env) },
  { id: 'threatfox', priority: 1, cost: 6, intervalMinutes: HOUR, run: (db, env) => ingestThreatFox(db, env) },
  { id: 'data-quality', priority: 1, cost: 2, intervalMinutes: HOUR, run: (db) => rpc(db, 'run_data_quality_checks') },
  { id: 'actor-status', priority: 1, cost: 2, intervalMinutes: HOUR, run: (db) => rpc(db, 'apply_actor_status') },
  { id: 'ioc-geo', priority: 1, cost: 2, intervalMinutes: HOUR, run: (db) => rpc(db, 'resolve_ioc_geo', { p_limit: 5000 }) },

  // --- Delivering what users asked to be told about ---
  // The window is wider than the cadence on purpose. Matching is deduplicated per
  // user and item (migration 104), so a run that covers ground an earlier run
  // already covered delivers nothing twice - which means a skipped hour heals
  // itself on the next run instead of leaving a gap in someone's alerts.
  { id: 'alert-rules', priority: 2, cost: 2, intervalMinutes: HOUR,
    run: (db) => rpc(db, 'evaluate_alert_rules', { p_since: '3 hours', p_max_matches: 5 }) },

  // --- Vulnerabilities: what R1/R2 in the offshoot spec depend on ---
  { id: 'cisa-kev', priority: 2, cost: 10, intervalMinutes: 6 * HOUR, run: (db, env) => ingestCISAKEV(db, env) },
  { id: 'vulncheck', priority: 3, cost: 6, intervalMinutes: 6 * HOUR, run: (db, env) => ingestVulnCheck(db, env) },
  { id: 'nvd', priority: 3, cost: 12, intervalMinutes: 6 * HOUR, run: (db, env) => ingestNVD(db, env) },
  { id: 'epss', priority: 3, cost: 10, intervalMinutes: DAY, run: (db, env) => ingestEPSS(db, env) },
  { id: 'cisa-ics', priority: 3, cost: 6, intervalMinutes: DAY, run: (db, env) => ingestCISAICS(db, env) },

  // --- IOC feeds ---
  { id: 'malwarebazaar', priority: 3, cost: 8, intervalMinutes: 6 * HOUR, run: (db, env) => ingestMalwareBazaar(db, env) },
  { id: 'pulsedive', priority: 3, cost: 6, intervalMinutes: 6 * HOUR, run: (db, env) => ingestPulsedive(db, env) },
  { id: 'urlhaus', priority: 3, cost: 10, intervalMinutes: 6 * HOUR, run: (db, env) => ingestURLhaus(db, env) },
  { id: 'feodo', priority: 3, cost: 4, intervalMinutes: 6 * HOUR, run: (db, env) => ingestFeodo(db, env) },
  { id: 'tor-exits', priority: 4, cost: 6, intervalMinutes: DAY, run: (db, env) => ingestTorExits(db, env) },

  // --- Sanctions, payments and group profiles ---
  { id: 'ofac-sdn', priority: 2, cost: 4, intervalMinutes: DAY, run: (db, env) => ingestOFAC(db, env) },
  { id: 'ransomware.live', priority: 3, cost: 12, intervalMinutes: DAY, run: (db, env) => ingestRansomwareLive(db, env) },
  { id: 'ransomwhere', priority: 4, cost: 10, intervalMinutes: DAY, run: (db, env) => ingestRansomwhere(db, env) },

  // --- Reference data ---
  { id: 'malpedia', priority: 4, cost: 12, intervalMinutes: DAY, run: (db, env) => ingestMalpedia(db, env) },
  { id: 'misp-galaxy', priority: 4, cost: 12, intervalMinutes: DAY, run: (db, env) => ingestMISPGalaxy(db, env) },
  { id: 'bgpstream', priority: 4, cost: 4, intervalMinutes: DAY, run: (db, env) => ingestBGPStream(db, env) },
  { id: 'anyrun-trends', priority: 4, cost: 4, intervalMinutes: DAY, run: (db, env) => ingestAnyRun(db, env) },
  { id: 'censys', priority: 4, cost: 6, intervalMinutes: DAY, run: (db, env) => enrichCensys(db, env) },
  { id: 'mitre', priority: 5, cost: 12, intervalMinutes: WEEK, run: (db, env) => ingestMITRE(db, env) },
  { id: 'mitre-atlas', priority: 5, cost: 6, intervalMinutes: WEEK, run: (db, env) => ingestMitreAtlas(db, env) }
]

export const JOBS_BY_ID = Object.fromEntries(JOBS.map(job => [job.id, job]))

/**
 * The database-side jobs return their counts in `data`. Normalizing them here
 * means the scheduler logs an RPC exactly as it logs a feed.
 */
async function rpc(db, functionName, params = {}) {
  const { data, error } = await db.rpc(functionName, params)
  if (error) return { success: false, error: error.message }
  return { success: true, ...(data && typeof data === 'object' ? data : { result: data }) }
}
