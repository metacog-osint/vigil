/**
 * SanctionsResult
 * The answer to "is this address sanctioned?" for a searched value. Renders
 * nothing unless the search term is an address on the OFAC SDN list, so an
 * ordinary hash or domain search is unaffected.
 */

import { useState, useEffect } from 'react'
import { profiles } from '../../lib/supabase'

export default function SanctionsResult({ value }) {
  const [hit, setHit] = useState(null)

  useEffect(() => {
    let cancelled = false
    const term = (value || '').trim()

    // Only worth a lookup for something shaped like a wallet address.
    if (!/^(0x[0-9a-fA-F]{40}|[13bcltrxDAGM][a-zA-Z0-9]{25,90})$/.test(term)) {
      setHit(null)
      return undefined
    }

    profiles
      .lookupSanctionedAddress(term)
      .then((row) => {
        if (!cancelled) setHit(row)
      })
      .catch(() => {
        if (!cancelled) setHit(null)
      })

    return () => {
      cancelled = true
    }
  }, [value])

  if (!hit) return null

  const delisted = Boolean(hit.delisted_at)

  return (
    <div
      className={`cyber-card border ${
        delisted ? 'border-yellow-700/50 bg-yellow-900/10' : 'border-red-700/50 bg-red-900/20'
      }`}
    >
      <div className="text-xs font-medium mb-1 tracking-wide">
        <span className={delisted ? 'text-yellow-400' : 'text-red-400'}>
          {delisted ? 'PREVIOUSLY OFAC DESIGNATED' : 'OFAC SANCTIONED ADDRESS'}
        </span>
      </div>
      <div className="font-mono text-sm text-white break-all">{hit.address}</div>
      <div className="text-xs text-gray-300 mt-2">
        {hit.currency} address designated under{' '}
        <span className="text-white">{hit.entity_name}</span>
        {hit.programs?.length > 0 && (
          <span className="text-gray-400"> ({hit.programs.join(', ')})</span>
        )}
      </div>
      {hit.aliases?.length > 0 && (
        <div className="text-xs text-gray-500 mt-1">Also known as: {hit.aliases.join('; ')}</div>
      )}
      <div className="text-xs text-gray-500 mt-2">
        {delisted
          ? `Removed from the SDN list on ${hit.delisted_at}; kept for historical lookups.`
          : 'Source: OFAC Specially Designated Nationals list, refreshed daily.'}
      </div>
    </div>
  )
}
