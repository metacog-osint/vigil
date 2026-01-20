// ATT&CK Matrix Heatmap visualization
import { useMemo } from 'react'
import { clsx } from 'clsx'

const TACTICS_ORDER = [
  'Reconnaissance',
  'Resource Development',
  'Initial Access',
  'Execution',
  'Persistence',
  'Privilege Escalation',
  'Defense Evasion',
  'Credential Access',
  'Discovery',
  'Lateral Movement',
  'Collection',
  'Command and Control',
  'Exfiltration',
  'Impact',
]

// Short names for mobile
const TACTIC_SHORT = {
  Reconnaissance: 'Recon',
  'Resource Development': 'Resource',
  'Initial Access': 'Initial',
  Execution: 'Exec',
  Persistence: 'Persist',
  'Privilege Escalation': 'PrivEsc',
  'Defense Evasion': 'DefEvas',
  'Credential Access': 'Creds',
  Discovery: 'Discov',
  'Lateral Movement': 'LatMov',
  Collection: 'Collect',
  'Command and Control': 'C2',
  Exfiltration: 'Exfil',
  Impact: 'Impact',
}

function getIntensityColor(count, maxCount) {
  if (count === 0) return 'bg-gray-800'
  const ratio = count / (maxCount || 1)
  if (ratio <= 0.2) return 'bg-red-900/40'
  if (ratio <= 0.4) return 'bg-red-800/50'
  if (ratio <= 0.6) return 'bg-red-700/60'
  if (ratio <= 0.8) return 'bg-red-600/70'
  return 'bg-red-500'
}

export function AttackMatrixHeatmap({
  techniques = [],
  actorTechniques = [], // Array of { technique_id, count }
  onTechniqueClick,
  className = '',
}) {
  const { matrix, maxCount } = useMemo(() => {
    // Build technique count lookup
    const countMap = new Map()
    for (const at of actorTechniques) {
      countMap.set(at.technique_id, (countMap.get(at.technique_id) || 0) + (at.count || 1))
    }

    // Group techniques by tactic
    const tacticMap = new Map()
    for (const tactic of TACTICS_ORDER) {
      tacticMap.set(tactic, [])
    }

    for (const tech of techniques) {
      if (tech.is_subtechnique) continue // Skip sub-techniques for cleaner view

      const count = countMap.get(tech.id) || 0
      for (const tactic of tech.tactics || []) {
        if (tacticMap.has(tactic)) {
          tacticMap.get(tactic).push({
            ...tech,
            count,
          })
        }
      }
    }

    // Sort techniques within each tactic by count
    for (const [tactic, techs] of tacticMap) {
      techs.sort((a, b) => b.count - a.count)
    }

    const maxCount = Math.max(...Array.from(countMap.values()), 0)

    return { matrix: tacticMap, maxCount }
  }, [techniques, actorTechniques])

  const maxTechniquesPerTactic = Math.max(...Array.from(matrix.values()).map((t) => t.length), 0)

  return (
    <div className={clsx('overflow-x-auto', className)}>
      {/* Header */}
      <div className="flex gap-1 mb-2 min-w-max">
        {TACTICS_ORDER.map((tactic) => (
          <div
            key={tactic}
            className="w-20 flex-shrink-0 text-xs text-gray-400 text-center truncate"
            title={tactic}
          >
            {TACTIC_SHORT[tactic]}
          </div>
        ))}
      </div>

      {/* Matrix grid */}
      <div className="flex gap-1 min-w-max">
        {TACTICS_ORDER.map((tactic) => {
          const techs = matrix.get(tactic) || []
          return (
            <div key={tactic} className="w-20 flex-shrink-0 space-y-1">
              {techs.slice(0, 15).map((tech) => (
                <button
                  key={tech.id}
                  onClick={() => onTechniqueClick?.(tech)}
                  className={clsx(
                    'w-full h-6 rounded text-xs truncate px-1',
                    getIntensityColor(tech.count, maxCount),
                    'hover:ring-1 hover:ring-white/50 transition-all',
                    tech.count > 0 ? 'text-white' : 'text-gray-600'
                  )}
                  title={`${tech.id}: ${tech.name} (${tech.count} actors)`}
                >
                  {tech.id.replace('T', '')}
                </button>
              ))}
              {techs.length > 15 && (
                <div className="text-xs text-gray-600 text-center">+{techs.length - 15} more</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 mt-4 text-xs text-gray-500">
        <span>Frequency:</span>
        <div className="flex gap-1">
          <div className="w-4 h-4 bg-gray-800 rounded" title="None" />
          <div className="w-4 h-4 bg-red-900/40 rounded" title="Low" />
          <div className="w-4 h-4 bg-red-700/60 rounded" title="Medium" />
          <div className="w-4 h-4 bg-red-500 rounded" title="High" />
        </div>
      </div>
    </div>
  )
}

export function AttackMatrixMini({ techniques = [], actorTechniques = [], className = '' }) {
  const tacticCounts = useMemo(() => {
    const techMap = new Map(techniques.map((t) => [t.id, t.tactics || []]))
    const counts = {}
    for (const tactic of TACTICS_ORDER) {
      counts[tactic] = 0
    }

    for (const at of actorTechniques) {
      const tactics = techMap.get(at.technique_id) || []
      for (const tactic of tactics) {
        if (counts[tactic] !== undefined) {
          counts[tactic] += at.count || 1
        }
      }
    }
    return counts
  }, [techniques, actorTechniques])

  const maxCount = Math.max(...Object.values(tacticCounts), 1)

  return (
    <div className={clsx('flex gap-0.5', className)}>
      {TACTICS_ORDER.map((tactic) => {
        const count = tacticCounts[tactic]
        return (
          <div
            key={tactic}
            className={clsx('w-4 h-8 rounded-sm', getIntensityColor(count, maxCount))}
            title={`${TACTIC_SHORT[tactic]}: ${count}`}
          />
        )
      })}
    </div>
  )
}

export default AttackMatrixHeatmap
