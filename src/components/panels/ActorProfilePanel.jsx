/**
 * ActorProfilePanel
 * The reference side of a group: whether it is OFAC-designated, what tooling it
 * runs, and where it publishes victims. Sourced from ransomware.live and the OFAC
 * SDN list; each section names its source so a reader can check the claim.
 */

import { useState, useEffect } from 'react'
import { profiles } from '../../lib/supabase'

function SanctionsNotice({ sanctions }) {
  if (sanctions.length === 0) return null

  return (
    <div className="p-3 rounded-lg bg-red-900/20 border border-red-700/50">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-red-400">OFAC DESIGNATED</span>
      </div>
      {sanctions.map((s) => (
        <div key={s.entity_uid} className="text-xs text-gray-300">
          Listed as <span className="text-white">{s.entity_name}</span>
          {s.programs?.length > 0 && (
            <span className="text-gray-400"> under {s.programs.join(', ')}</span>
          )}
          <div className="text-gray-500 mt-0.5">
            {s.match_basis === 'name'
              ? 'Matched on the designated entity name'
              : 'Matched on an alias OFAC publishes, confirmed in review'}
            {' · '}
            Transacting with this group may carry sanctions exposure.
          </div>
        </div>
      ))}
    </div>
  )
}

function TakedownSection({ takedowns, resumed }) {
  if (takedowns.length === 0) return null

  return (
    <div
      className={`p-3 rounded-lg border ${
        resumed ? 'bg-amber-900/20 border-amber-700/50' : 'bg-gray-800/60 border-gray-700'
      }`}
    >
      <div className="text-xs font-medium mb-1 tracking-wide">
        <span className={resumed ? 'text-amber-400' : 'text-gray-400'}>
          {resumed ? 'SEIZED, THEN RESUMED' : 'DISRUPTED BY LAW ENFORCEMENT'}
        </span>
      </div>
      {takedowns.map((t) => (
        <div key={`${t.event_date}-${t.source_url}`} className="text-xs text-gray-300 mt-1">
          <span className="text-white">{t.event_date}</span>
          {t.operation_name && <span className="text-gray-400"> · {t.operation_name}</span>}
          {t.authorities?.length > 0 && (
            <span className="text-gray-400"> · {t.authorities.join(', ')}</span>
          )}
          <div className="text-gray-400 mt-0.5">{t.summary}</div>
          <a
            href={t.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyber-accent hover:underline"
          >
            {t.source_title || 'Source'} →
          </a>
        </div>
      ))}
      {resumed && (
        <div className="text-xs text-amber-300/90 mt-2">
          The group has claimed victims since this action, so it is still counted as active.
        </div>
      )}
    </div>
  )
}

function ToolSection({ tools }) {
  if (tools.length === 0) return null

  const byCategory = tools.reduce((acc, t) => {
    const key = t.category || 'Other'
    acc[key] = acc[key] || []
    acc[key].push(t.tool_name)
    return acc
  }, {})

  return (
    <div>
      <div className="text-gray-500 mb-1">Tooling ({tools.length})</div>
      <div className="space-y-2">
        {Object.entries(byCategory).map(([category, names]) => (
          <div key={category}>
            <div className="text-xs text-gray-600 uppercase tracking-wide">{category}</div>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {names.map((name) => (
                <span
                  key={name}
                  className="text-xs font-mono text-gray-300 bg-gray-800/70 px-1.5 py-0.5 rounded"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SiteSection({ sites }) {
  if (sites.length === 0) return null

  const reachable = sites.filter((s) => s.available).length

  return (
    <div>
      <div className="text-gray-500 mb-1">
        Leak sites ({sites.length}
        {sites.length > 0 && `, ${reachable} reachable`})
      </div>
      <div className="space-y-1">
        {sites.slice(0, 6).map((site) => (
          <div key={site.fqdn} className="flex items-start gap-2">
            <span
              className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                site.available ? 'bg-green-500' : 'bg-gray-600'
              }`}
              title={site.available ? 'Reachable at last check' : 'Not reachable at last check'}
            />
            {/* Addresses are shown as text, never as links. */}
            <span className="text-xs font-mono text-gray-400 break-all">{site.fqdn}</span>
          </div>
        ))}
        {sites.length > 6 && <div className="text-xs text-gray-600">+{sites.length - 6} more</div>}
      </div>
    </div>
  )
}

export default function ActorProfilePanel({ actorId, lastVictim }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    profiles
      .getActorProfile(actorId)
      .then((data) => {
        if (!cancelled) setProfile(data)
      })
      .catch(() => {
        if (!cancelled) setProfile(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [actorId])

  if (loading) {
    return <div className="h-16 bg-gray-800/50 rounded animate-pulse" />
  }

  if (!profile) return null

  const { tools, sites, sanctions, takedowns = [] } = profile
  if (
    tools.length === 0 &&
    sites.length === 0 &&
    sanctions.length === 0 &&
    takedowns.length === 0
  ) {
    return null
  }

  // A takedown followed by fresh victims is the interesting case, and the one a
  // reader is most likely to get wrong.
  const latestEvent = takedowns[0]?.event_date
  const resumed = Boolean(latestEvent && lastVictim && lastVictim > latestEvent)

  return (
    <div className="space-y-4">
      <TakedownSection takedowns={takedowns} resumed={resumed} />
      <SanctionsNotice sanctions={sanctions} />
      <ToolSection tools={tools} />
      <SiteSection sites={sites} />
      <div className="text-xs text-gray-600">
        Profile data from ransomware.live; designations from the OFAC SDN list; takedowns from the
        announcing authority.
      </div>
    </div>
  )
}
