/**
 * A country filter that says which geography it means.
 *
 * Vigil keeps three of them apart on purpose: where a group is from, where its
 * infrastructure sits, and where its victims are. They are different claims,
 * and a control labelled only "Country" invites the reader to merge them -
 * which is the fault the actor-origin work exists to prevent, after a feed
 * wrote origin into target_countries and had Vigil asserting that the Equation
 * Group targets the United States.
 *
 * So `geography` is required, and it is shown to the user rather than only
 * living in the code.
 *
 * The options come from the database (migration 128), not from a list of every
 * country: an option that returns nothing is a worse answer than no option.
 */
import { useMemo } from 'react'

const GEOGRAPHY_LABELS = {
  victim: 'Victim country',
  origin: 'Origin country',
  target: 'Targets country',
  infrastructure: 'Hosted in',
}

const GEOGRAPHY_HELP = {
  victim: 'Where the victim organisation is',
  origin: 'Where the group is assessed to operate from',
  target: 'Where the group is recorded as attacking',
  infrastructure: 'Where the indicator is hosted',
}

/** ISO-2 to a readable name, without a list of our own to keep current. */
function countryName(code) {
  try {
    return new Intl.DisplayNames(undefined, { type: 'region' }).of(code) || code
  } catch {
    return code
  }
}

export function CountryFilter({
  geography,
  value,
  onChange,
  options = [],
  countKey = 'incidents',
  loading = false,
  id,
}) {
  const label = GEOGRAPHY_LABELS[geography] || 'Country'
  const help = GEOGRAPHY_HELP[geography]
  const selectId = id || `country-filter-${geography}`

  const sorted = useMemo(
    () =>
      [...options].map((o) => ({
        ...o,
        name: countryName(o.country_code),
      })),
    [options]
  )

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="text-xs text-gray-500">
        {label}
      </label>
      <select
        id={selectId}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="cyber-input text-sm"
        title={help}
        disabled={loading}
      >
        <option value="">
          {loading ? 'Loading countries…' : `All countries (${sorted.length})`}
        </option>
        {sorted.map((o) => (
          <option key={o.country_code} value={o.country_code}>
            {o.name} ({Number(o[countKey] ?? 0).toLocaleString()})
          </option>
        ))}
      </select>
    </div>
  )
}

/**
 * What a country filter can see at all.
 *
 * Every one of these is partial, and two of them badly so. Filtering by
 * country therefore hides most of the dataset - so the page says that plainly
 * rather than presenting a filtered view as the whole.
 */
export function CountryCoverageNote({ coverage, geography }) {
  if (!coverage) return null

  const { with_country: withCountry, total, most_recent: mostRecent } = coverage
  if (typeof withCountry !== 'number' || typeof total !== 'number' || total === 0) return null

  const percent = Math.round((withCountry / total) * 100)
  const stale =
    mostRecent && Date.now() - new Date(mostRecent).getTime() > 60 * 24 * 60 * 60 * 1000

  return (
    <p className="text-xs text-gray-500">
      {GEOGRAPHY_LABELS[geography] || 'Country'} is recorded for{' '}
      {withCountry.toLocaleString()} of {total.toLocaleString()} ({percent}%). Filtering by
      country hides the rest.
      {stale && mostRecent && (
        <>
          {' '}
          The most recent one is {new Date(mostRecent).toLocaleDateString()} — the source that
          supplied it stopped.
        </>
      )}
    </p>
  )
}

export default CountryFilter
