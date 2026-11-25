/**
 * Per-invocation limits, shared by the worker and the schedule capacity test.
 *
 * The account moved to Workers Paid on 17 Nov 2026. The
 * platform now allows 10,000 subrequests an invocation, up from Workers Free's
 * 50. Free's cap is what cut the 03:15 UTC tick that day short with nothing
 * recorded (lib/subrequests.js).
 *
 * The worker keeps its own ceiling well under the platform's, so a feed that
 * loops stops here with a budget_exhausted row rather than at the platform's
 * cap with none. The gap also covers what the meter cannot see: Cloudflare
 * counts each hop of a redirect as a subrequest, and the meter counts one call.
 * The busiest tick on record used about 50; 1,000 is twenty times that.
 *
 * The reserve is what one feed's bookkeeping needs after it stops: its own
 * sync_log row, the summary row, and the error row if the summary fails. Every
 * earlier call is already counted, so it no longer grows with the number of
 * jobs, which is what the old fixed 18 got wrong.
 */
export const SUBREQUEST_LIMIT = 1000
export const SUBREQUEST_RESERVE = 5
