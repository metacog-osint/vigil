import { useState, useEffect, useMemo } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import {
  supabase,
  attributedActivity,
  ATTRIBUTION_STRENGTHS,
  ATTRIBUTION_STRENGTH_LABELS,
  ATTRIBUTION_STRENGTH_COLORS,
  ATTRIBUTION_SOURCE_LABELS,
} from '../lib/supabase'
import { CoverageNote } from './common'
import { geoToIso2 } from '../lib/countryCodes'

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

// Country code to name mapping for common codes
const COUNTRY_NAMES = {
  US: 'United States',
  USA: 'United States',
  UK: 'United Kingdom',
  GB: 'United Kingdom',
  DE: 'Germany',
  FR: 'France',
  CA: 'Canada',
  AU: 'Australia',
  JP: 'Japan',
  CN: 'China',
  RU: 'Russia',
  BR: 'Brazil',
  IN: 'India',
  IT: 'Italy',
  ES: 'Spain',
  NL: 'Netherlands',
  BE: 'Belgium',
  CH: 'Switzerland',
  AT: 'Austria',
  SE: 'Sweden',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  PL: 'Poland',
  CZ: 'Czech Republic',
  MX: 'Mexico',
  AR: 'Argentina',
  CL: 'Chile',
  CO: 'Colombia',
  ZA: 'South Africa',
  AE: 'United Arab Emirates',
  SA: 'Saudi Arabia',
  IL: 'Israel',
  SG: 'Singapore',
  KR: 'South Korea',
  TW: 'Taiwan',
  HK: 'Hong Kong',
  NZ: 'New Zealand',
  IE: 'Ireland',
  PT: 'Portugal',
  GR: 'Greece',
  TR: 'Turkey',
  TH: 'Thailand',
  MY: 'Malaysia',
  ID: 'Indonesia',
  PH: 'Philippines',
  VN: 'Vietnam',
}

// ISO 3166-1 alpha-3 to alpha-2 conversion (comprehensive)
const ISO3_TO_ISO2 = {
  USA: 'US',
  GBR: 'GB',
  DEU: 'DE',
  FRA: 'FR',
  CAN: 'CA',
  AUS: 'AU',
  JPN: 'JP',
  CHN: 'CN',
  RUS: 'RU',
  BRA: 'BR',
  IND: 'IN',
  ITA: 'IT',
  ESP: 'ES',
  NLD: 'NL',
  BEL: 'BE',
  CHE: 'CH',
  AUT: 'AT',
  SWE: 'SE',
  NOR: 'NO',
  DNK: 'DK',
  FIN: 'FI',
  POL: 'PL',
  CZE: 'CZ',
  MEX: 'MX',
  ARG: 'AR',
  CHL: 'CL',
  COL: 'CO',
  ZAF: 'ZA',
  ARE: 'AE',
  SAU: 'SA',
  ISR: 'IL',
  SGP: 'SG',
  KOR: 'KR',
  TWN: 'TW',
  HKG: 'HK',
  NZL: 'NZ',
  IRL: 'IE',
  PRT: 'PT',
  GRC: 'GR',
  TUR: 'TR',
  THA: 'TH',
  MYS: 'MY',
  IDN: 'ID',
  PHL: 'PH',
  VNM: 'VN',
  EGY: 'EG',
  NGA: 'NG',
  KEN: 'KE',
  MAR: 'MA',
  PAK: 'PK',
  BGD: 'BD',
  UKR: 'UA',
  ROU: 'RO',
  HUN: 'HU',
  SVK: 'SK',
  BGR: 'BG',
  HRV: 'HR',
  SVN: 'SI',
  SRB: 'RS',
  LTU: 'LT',
  LVA: 'LV',
  EST: 'EE',
  CYP: 'CY',
  MLT: 'MT',
  LUX: 'LU',
  PER: 'PE',
  VEN: 'VE',
  ECU: 'EC',
  URY: 'UY',
  PRY: 'PY',
  BOL: 'BO',
  CRI: 'CR',
  PAN: 'PA',
  GTM: 'GT',
  SLV: 'SV',
  HND: 'HN',
  NIC: 'NI',
  DOM: 'DO',
  PRI: 'PR',
  JAM: 'JM',
  TTO: 'TT',
  CUB: 'CU',
  IRN: 'IR',
  IRQ: 'IQ',
  AFG: 'AF',
  SYR: 'SY',
  LBN: 'LB',
  JOR: 'JO',
  KWT: 'KW',
  QAT: 'QA',
  BHR: 'BH',
  OMN: 'OM',
  YEM: 'YE',
  LBY: 'LY',
  TUN: 'TN',
  DZA: 'DZ',
  SDN: 'SD',
  ETH: 'ET',
  TZA: 'TZ',
  UGA: 'UG',
  GHA: 'GH',
  CMR: 'CM',
  CIV: 'CI',
  SEN: 'SN',
  ZWE: 'ZW',
  ZMB: 'ZM',
  MWI: 'MW',
  MOZ: 'MZ',
  AGO: 'AO',
  NAM: 'NA',
  BWA: 'BW',
  NPL: 'NP',
  LKA: 'LK',
  MMR: 'MM',
  KHM: 'KH',
  LAO: 'LA',
  MNG: 'MN',
  PRK: 'KP',
  BLR: 'BY',
  MDA: 'MD',
  GEO: 'GE',
  ARM: 'AM',
  AZE: 'AZ',
  KAZ: 'KZ',
  UZB: 'UZ',
  TKM: 'TM',
  KGZ: 'KG',
  TJK: 'TJ',
  ALB: 'AL',
  MKD: 'MK',
  MNE: 'ME',
  BIH: 'BA',
  ISL: 'IS',
  MCO: 'MC',
  AND: 'AD',
  LIE: 'LI',
  SMR: 'SM',
  VAT: 'VA',
}

// Create reverse mapping for compatibility (reserved for future use)
const _ISO2_TO_ISO3 = Object.fromEntries(
  Object.entries(ISO3_TO_ISO2).map(([iso3, iso2]) => [iso2, iso3])
)

export default function ThreatAttributionMap({
  days = 30,
  viewMode = 'victims', // 'victims' | 'attackers' | 'attributed' | 'industry'
  onCountryClick,
  selectedCountry = null,
  height = 400,
}) {
  const [countryData, setCountryData] = useState({})
  const [actorOrigins, setActorOrigins] = useState({})
  // Government advisories, keyed by the country the advisory blames.
  const [attributed, setAttributed] = useState({})
  const [attributedCoverage, setAttributedCoverage] = useState(null)
  const [coverage, setCoverage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState(null)
  const [position, setPosition] = useState({ coordinates: [0, 20], zoom: 1 })

  // The date of the most recent incident that had a country at all, so an empty
  // window can say when the data stopped rather than just showing nothing.
  const [lastCountryDate, setLastCountryDate] = useState(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('incidents')
      .select('discovered_date')
      .not('victim_country', 'is', null)
      .order('discovered_date', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (!cancelled) setLastCountryDate(data?.[0]?.discovered_date || null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Fetch victim country data
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - days)

      // Every incident in the window, including those without a country: the ones
      // that cannot be plotted are exactly what the coverage note has to report.
      const { data: incidents } = await supabase
        .from('incidents')
        .select(
          'victim_country, victim_sector, actor_id, threat_actor:threat_actors(name, actor_type)'
        )
        .gte('discovered_date', cutoffDate.toISOString())

      if (incidents) {
        setCoverage({
          total: incidents.length,
          covered: incidents.filter((inc) => inc.victim_country).length,
        })

        // Aggregate by country
        const byCountry = {}
        incidents.forEach((inc) => {
          const country = inc.victim_country?.toUpperCase()
          if (!country) return

          if (!byCountry[country]) {
            byCountry[country] = {
              count: 0,
              sectors: {},
              actors: {},
            }
          }
          byCountry[country].count++

          // Track sectors
          if (inc.victim_sector) {
            byCountry[country].sectors[inc.victim_sector] =
              (byCountry[country].sectors[inc.victim_sector] || 0) + 1
          }

          // Track actors
          if (inc.threat_actor?.name) {
            byCountry[country].actors[inc.threat_actor.name] =
              (byCountry[country].actors[inc.threat_actor.name] || 0) + 1
          }
        })
        setCountryData(byCountry)
      }

      // Attributed country of origin, from its own column rather than from
      // metadata or - as it used to be - from the targeting field (migration 098).
      const { data: actors } = await supabase
        .from('threat_actors')
        .select('name, origin_country, origin_confidence')
        .not('origin_country', 'is', null)

      if (actors) {
        const origins = {}
        actors.forEach((actor) => {
          const country = actor.origin_country.toUpperCase()
          if (!origins[country]) {
            origins[country] = { count: 0, actors: [], confidences: [] }
          }
          origins[country].count++
          origins[country].actors.push(actor.name)
          if (actor.origin_confidence !== null && actor.origin_confidence !== undefined) {
            origins[country].confidences.push(actor.origin_confidence)
          }
        })

        // Attribution is a claim, so the tooltip carries the source's confidence.
        for (const entry of Object.values(origins)) {
          entry.avgConfidence = entry.confidences.length
            ? Math.round(entry.confidences.reduce((a, b) => a + b, 0) / entry.confidences.length)
            : null
        }

        setActorOrigins(origins)
      }

      // Government attribution. Not filtered by `days`: there are ten
      // advisories in total and a 30-day window would usually show none, which
      // would read as "no state activity" rather than "none announced this
      // month". The footer says which period is actually on screen.
      const [{ data: index }, { data: advisoryCoverage }] = await Promise.all([
        attributedActivity.getCountryIndex(),
        attributedActivity.getCoverage(),
      ])
      if (index) setAttributed(index)
      if (advisoryCoverage) setAttributedCoverage(advisoryCoverage)

      setLoading(false)
    }

    fetchData()
  }, [days])

  // Which dataset this view draws from. Three layers now answer three
  // different questions, and nothing may average across them.
  const activeData =
    viewMode === 'attackers' ? actorOrigins : viewMode === 'attributed' ? attributed : countryData

  // Calculate color intensity based on count
  const getColor = (countryCode) => {
    const data = activeData
    // geoToIso2 has already resolved the atlas's numeric id to ISO-2
    const countryInfo = data[countryCode]
    if (!countryInfo) return '#1f2937' // Default dark gray

    // Attribution is not a quantity. Three advisories calling a country's
    // actors "pro-Russia hacktivists" are not a stronger claim than one
    // calling them "state-sponsored", so this layer colours by the kind of
    // claim rather than by how many were made. A shaded ramp here would say
    // the opposite of what the advisories say.
    if (viewMode === 'attributed') {
      return ATTRIBUTION_STRENGTH_COLORS[countryInfo.strongest] || '#4b5563'
    }

    const count = countryInfo.count || 0
    const maxCount = Math.max(...Object.values(data).map((d) => d.count || 0), 1)
    const intensity = Math.min(count / maxCount, 1)

    if (viewMode === 'attackers') {
      // Red gradient for attacker origins
      if (intensity > 0.7) return '#dc2626'
      if (intensity > 0.4) return '#ef4444'
      if (intensity > 0.2) return '#f87171'
      if (intensity > 0) return '#fca5a5'
      return '#1f2937'
    } else {
      // Cyan gradient for victim locations
      if (intensity > 0.7) return '#0891b2'
      if (intensity > 0.4) return '#06b6d4'
      if (intensity > 0.2) return '#22d3ee'
      if (intensity > 0) return '#67e8f9'
      return '#1f2937'
    }
  }

  // Get country name from code
  const getCountryName = (geo) => {
    return geo.properties?.name || geo.properties?.NAME || 'Unknown'
  }

  // Get tooltip content
  const getTooltipContent = (countryCode, countryName) => {
    const data = activeData
    // geoToIso2 has already resolved the atlas's numeric id to ISO-2
    const countryInfo = data[countryCode]

    if (!countryInfo || countryInfo.count === 0) {
      return { name: countryName, count: 0 }
    }

    if (viewMode === 'attributed') {
      // The advisory's own words, not a paraphrase and not a country flag.
      return {
        name: countryName,
        count: countryInfo.count,
        strongest: countryInfo.strongest,
        phrases: countryInfo.phrases || [],
        sources: countryInfo.sources || [],
        advisories: (countryInfo.advisories || []).slice(0, 3),
      }
    }

    if (viewMode === 'attackers') {
      return {
        name: countryName,
        count: countryInfo.count,
        actors: countryInfo.actors?.slice(0, 5) || [],
      }
    }

    // Sort sectors and actors by count
    const topSectors = Object.entries(countryInfo.sectors || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
    const topActors = Object.entries(countryInfo.actors || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)

    return {
      name: countryName,
      count: countryInfo.count,
      topSectors,
      topActors,
    }
  }

  const handleMouseEnter = (geo, evt) => {
    const countryCode = geoToIso2(geo)
    const countryName = getCountryName(geo)
    const content = getTooltipContent(countryCode, countryName)

    setTooltip({
      ...content,
      x: evt.clientX,
      y: evt.clientY,
    })
  }

  const handleMouseLeave = () => {
    setTooltip(null)
  }

  const handleClick = (geo) => {
    const countryCode = geoToIso2(geo)
    const countryName = getCountryName(geo)
    const data = activeData
    // geoToIso2 has already resolved the atlas's numeric id to ISO-2
    const countryInfo = data[countryCode]

    if (onCountryClick && countryInfo?.count > 0) {
      onCountryClick({
        code: countryCode,
        name: countryName,
        ...countryInfo,
      })
    }
  }

  // Stats summary
  const stats = useMemo(() => {
    const data =
      viewMode === 'attackers' ? actorOrigins : viewMode === 'attributed' ? attributed : countryData
    const totalCountries = Object.keys(data).length
    const totalIncidents = Object.values(data).reduce((sum, d) => sum + (d.count || 0), 0)
    const topCountry = Object.entries(data).sort((a, b) => (b[1].count || 0) - (a[1].count || 0))[0]

    return { totalCountries, totalIncidents, topCountry }
  }, [countryData, actorOrigins, attributed, viewMode])

  // What the unit on screen is called. Saying "incidents" over a layer of
  // government advisories would be the conflation this table exists to avoid.
  const unitLabel =
    viewMode === 'attackers' ? 'actors' : viewMode === 'attributed' ? 'advisories' : 'incidents'

  return (
    <div className="relative">
      {/* Stats bar */}
      <div className="flex items-center justify-between mb-2 text-xs text-gray-400">
        <div className="flex gap-4">
          <span>{stats.totalCountries} countries</span>
          <span>
            {stats.totalIncidents} {unitLabel}
          </span>
          {stats.topCountry && (
            <span>
              Top: {COUNTRY_NAMES[stats.topCountry[0]] || stats.topCountry[0]} (
              {stats.topCountry[1].count})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">Zoom:</span>
          <button
            onClick={() => setPosition((p) => ({ ...p, zoom: Math.min(p.zoom * 1.5, 8) }))}
            className="px-2 py-0.5 bg-gray-800 rounded hover:bg-gray-700"
          >
            +
          </button>
          <button
            onClick={() => setPosition((p) => ({ ...p, zoom: Math.max(p.zoom / 1.5, 1) }))}
            className="px-2 py-0.5 bg-gray-800 rounded hover:bg-gray-700"
          >
            -
          </button>
          <button
            onClick={() => setPosition({ coordinates: [0, 20], zoom: 1 })}
            className="px-2 py-0.5 bg-gray-800 rounded hover:bg-gray-700"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Map */}
      <div
        className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden"
        style={{ height }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
          </div>
        ) : (
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{
              scale: 120,
              center: [0, 20],
            }}
            style={{ width: '100%', height: '100%' }}
          >
            <ZoomableGroup
              zoom={position.zoom}
              center={position.coordinates}
              onMoveEnd={setPosition}
            >
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const countryCode = geoToIso2(geo)
                    const isSelected = selectedCountry === countryCode

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={getColor(countryCode)}
                        stroke={isSelected ? '#06b6d4' : '#374151'}
                        strokeWidth={isSelected ? 1.5 : 0.5}
                        style={{
                          default: { outline: 'none' },
                          hover: {
                            fill:
                              viewMode === 'attackers'
                                ? '#f87171'
                                : viewMode === 'attributed'
                                  ? '#f59e0b'
                                  : '#22d3ee',
                            outline: 'none',
                            cursor: 'pointer',
                          },
                          pressed: { outline: 'none' },
                        }}
                        onMouseEnter={(evt) => handleMouseEnter(geo, evt)}
                        onMouseLeave={handleMouseLeave}
                        onClick={() => handleClick(geo)}
                      />
                    )
                  })
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>
        )}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-3 pointer-events-none"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y + 10,
            maxWidth: 250,
          }}
        >
          <div className="font-semibold text-white mb-1">{tooltip.name}</div>
          {tooltip.count > 0 ? (
            <>
              <div className="text-cyan-400 text-sm mb-2">
                {tooltip.count}{' '}
                {viewMode === 'attackers'
                  ? 'threat actors'
                  : viewMode === 'attributed'
                    ? tooltip.count === 1
                      ? 'government advisory'
                      : 'government advisories'
                    : 'incidents'}
              </div>
              {viewMode === 'attributed' && (
                <>
                  {/* The source's exact wording. Vigil did not decide this and
                      does not paraphrase it. */}
                  {tooltip.phrases?.length > 0 && (
                    <div className="mb-2">
                      <div className="text-xs text-gray-500 mb-1">Attributed as:</div>
                      {tooltip.phrases.map((phrase) => (
                        <div key={phrase} className="text-xs text-gray-200 italic">
                          &ldquo;{phrase}&rdquo;
                        </div>
                      ))}
                    </div>
                  )}
                  {tooltip.sources?.length > 0 && (
                    <div className="mb-2 text-xs text-gray-400">
                      {/* Two governments naming a country separately is a
                          different position from one naming it twice. */}
                      {tooltip.sources.length > 1
                        ? `Attributed independently by ${tooltip.sources.length} governments: `
                        : 'Attributed by '}
                      {tooltip.sources
                        .map((src) => ATTRIBUTION_SOURCE_LABELS[src] || src)
                        .join(', ')}
                    </div>
                  )}
                  {tooltip.strongest && (
                    <div className="mb-2 flex items-center gap-1.5">
                      <span
                        className="inline-block w-2 h-2 rounded-sm"
                        style={{
                          backgroundColor:
                            ATTRIBUTION_STRENGTH_COLORS[tooltip.strongest] || '#4b5563',
                        }}
                      />
                      <span className="text-xs text-gray-400">
                        Strongest claim:{' '}
                        {ATTRIBUTION_STRENGTH_LABELS[tooltip.strongest] || tooltip.strongest}
                      </span>
                    </div>
                  )}
                  {tooltip.advisories?.length > 0 && (
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Advisories:</div>
                      {tooltip.advisories.map((a) => (
                        <div key={a.advisory_id} className="text-xs text-gray-300 mb-1">
                          {/* CISA numbers its advisories and the number is worth
                              showing. NCSC does not, so its id is the URL slug -
                              a restatement of the title, forty characters wide.
                              Show the date instead. */}
                          <span className="font-mono text-gray-500">
                            {/^AA?\d{2}-\d{3}[A-Z]?$/.test(a.advisory_id)
                              ? a.advisory_id
                              : a.published}
                          </span>{' '}
                          {a.title}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              {tooltip.topActors && tooltip.topActors.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs text-gray-500 mb-1">Top Actors:</div>
                  {tooltip.topActors.map(([name, count]) => (
                    <div key={name} className="text-xs text-gray-300">
                      {name} ({count})
                    </div>
                  ))}
                </div>
              )}
              {tooltip.topSectors && tooltip.topSectors.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Top Sectors:</div>
                  {tooltip.topSectors.map(([sector, count]) => (
                    <div key={sector} className="text-xs text-gray-300 capitalize">
                      {sector} ({count})
                    </div>
                  ))}
                </div>
              )}
              {tooltip.actors && tooltip.actors.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Active Actors:</div>
                  {tooltip.actors.map((name) => (
                    <div key={name} className="text-xs text-red-400">
                      {name}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-gray-500 text-sm">No data</div>
          )}
        </div>
      )}

      {/* Legend */}
      {viewMode === 'attributed' ? (
        /* Not a scale. Five kinds of claim, in the order of how much state
           involvement the source asserts - and "aligned" explicitly denies it.
           Rendering these as one gradient would say they differ by degree. */
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-400">
          {[...ATTRIBUTION_STRENGTHS].reverse().map((strength) => (
            <div key={strength} className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: ATTRIBUTION_STRENGTH_COLORS[strength] }}
              />
              <span>{ATTRIBUTION_STRENGTH_LABELS[strength]}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: viewMode === 'attackers' ? '#fca5a5' : '#67e8f9' }}
            />
            <span>Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: viewMode === 'attackers' ? '#f87171' : '#22d3ee' }}
            />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: viewMode === 'attackers' ? '#ef4444' : '#06b6d4' }}
            />
            <span>High</span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: viewMode === 'attackers' ? '#dc2626' : '#0891b2' }}
            />
            <span>Critical</span>
          </div>
        </div>
      )}

      {/* What the map can and cannot show for this window */}
      {!loading && coverage && viewMode === 'victims' && (
        <CoverageNote
          covered={coverage.covered}
          total={coverage.total}
          lastCovered={lastCountryDate}
          className="mt-2"
        />
      )}
      {!loading && viewMode === 'attackers' && (
        <p className="text-xs text-gray-500 mt-2">
          Attributed country of origin for{' '}
          {Object.values(actorOrigins).reduce((n, o) => n + o.count, 0)} groups, as published by
          MISP galaxy with its own confidence score. Attribution is a claim, not an observation.
        </p>
      )}
      {!loading && viewMode === 'attributed' && (
        <p className="text-xs text-gray-500 mt-2">
          {attributedCoverage
            ? `${attributedCoverage.attributed} of ${attributedCoverage.total} government advisories name a country`
            : 'Government advisories'}
          , in the words the advisory used. Unlike the other two layers this one ignores the {days}
          -day window: advisories are published a few a month and a short window would read as an
          absence of state activity rather than an absence of announcements. These are not incidents
          and are never counted alongside them.
        </p>
      )}
    </div>
  )
}

// Compact map for dashboard widget
export function ThreatMapMini({ days = 30, onViewFull }) {
  return (
    <div className="cyber-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-white">Global Threat Map</h3>
        {onViewFull && (
          <button onClick={onViewFull} className="text-xs text-cyan-400 hover:text-cyan-300">
            Expand
          </button>
        )}
      </div>
      <ThreatAttributionMap days={days} height={200} />
    </div>
  )
}
