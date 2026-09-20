/**
 * CoverageNote
 *
 * States how much of the underlying data a view is actually able to show.
 *
 * Geographic views only plot incidents whose source named a country, and most
 * do not: a map drawn from 29% of the data looks exactly like a map drawn from
 * all of it unless it says otherwise. This says otherwise.
 */

export default function CoverageNote({
  covered,
  total,
  lastCovered = null,
  noun = 'incidents',
  attribute = 'country',
  className = '',
}) {
  if (total === null || total === undefined) return null

  const percent = total > 0 ? Math.round((covered / total) * 100) : 0
  const base = `text-xs text-gray-500 ${className}`

  if (total === 0) {
    return <p className={base}>No {noun} in this period.</p>
  }

  // The honest headline when a view has nothing to draw.
  if (covered === 0) {
    return (
      <p className={`text-xs text-amber-500/90 ${className}`}>
        No {attribute} recorded for any of the {total.toLocaleString()} {noun} in this period, so
        nothing is plotted.
        {lastCovered &&
          ` The most recent ${noun.replace(/s$/, '')} with a ${attribute} is ${lastCovered}.`}
      </p>
    )
  }

  return (
    <p className={base}>
      Based on {covered.toLocaleString()} of {total.toLocaleString()} {noun} ({percent}%) whose
      source named a {attribute}. The remaining {100 - percent}% are not shown.
    </p>
  )
}
