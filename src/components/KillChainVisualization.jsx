import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// Check if MITRE techniques feature is enabled (disabled by default to prevent 404s)
const MITRE_ENABLED = import.meta.env.VITE_ENABLE_MITRE === 'true'

// MITRE ATT&CK Tactics mapped to Lockheed Martin Kill Chain
const KILL_CHAIN_PHASES = [
  {
    id: 'reconnaissance',
    name: 'Reconnaissance',
    shortName: 'Recon',
    description: 'Gathering information to plan the attack',
    tactics: ['reconnaissance'],
    color: '#6366f1', // Indigo
  },
  {
    id: 'weaponization',
    name: 'Weaponization',
    shortName: 'Weapon',
    description: 'Creating malware and exploit payloads',
    tactics: ['resource-development'],
    color: '#8b5cf6', // Violet
  },
  {
    id: 'delivery',
    name: 'Delivery',
    shortName: 'Deliver',
    description: 'Transmitting the weapon to the target',
    tactics: ['initial-access'],
    color: '#a855f7', // Purple
  },
  {
    id: 'exploitation',
    name: 'Exploitation',
    shortName: 'Exploit',
    description: 'Triggering the vulnerability',
    tactics: ['execution'],
    color: '#d946ef', // Fuchsia
  },
  {
    id: 'installation',
    name: 'Installation',
    shortName: 'Install',
    description: 'Installing backdoors and persistence',
    tactics: ['persistence', 'privilege-escalation', 'defense-evasion'],
    color: '#ec4899', // Pink
  },
  {
    id: 'command-control',
    name: 'Command & Control',
    shortName: 'C2',
    description: 'Establishing communication channel',
    tactics: ['command-and-control'],
    color: '#f43f5e', // Rose
  },
  {
    id: 'actions',
    name: 'Actions on Objectives',
    shortName: 'Actions',
    description: 'Achieving the attack goal',
    tactics: ['collection', 'exfiltration', 'impact'],
    color: '#ef4444', // Red
  },
]

export default function KillChainVisualization({
  actorId = null,
  days = 30,
  onPhaseClick,
  showDetails = true,
}) {
  const [techniqueData, setTechniqueData] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedPhase, setSelectedPhase] = useState(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      // Get techniques with their tactics
      // Skip if MITRE feature is disabled (prevents 404 errors if table doesn't exist)
      let techniques = []
      if (MITRE_ENABLED) {
        try {
          const { data, error } = await supabase
            .from('mitre_techniques')
            .select('technique_id, name, tactic, description')

          if (!error && data) {
            techniques = data
          }
        } catch {
          // Table may not exist - continue with empty techniques
        }
      }

      // If we have an actor, get their specific TTPs
      let actorTtps = []
      if (actorId) {
        const { data: actor } = await supabase
          .from('threat_actors')
          .select('ttps')
          .eq('id', actorId)
          .single()

        if (actor?.ttps) {
          actorTtps = actor.ttps
        }
      } else {
        // Get most common TTPs from actors
        const { data: actors } = await supabase
          .from('threat_actors')
          .select('ttps')
          .not('ttps', 'is', null)
          .limit(100)

        if (actors) {
          const ttpCounts = {}
          actors.forEach(a => {
            a.ttps?.forEach(t => {
              ttpCounts[t] = (ttpCounts[t] || 0) + 1
            })
          })
          actorTtps = Object.keys(ttpCounts)
        }
      }

      // Map techniques to phases
      const phaseData = {}
      KILL_CHAIN_PHASES.forEach(phase => {
        phaseData[phase.id] = {
          ...phase,
          techniques: [],
          count: 0,
          intensity: 0,
        }
      })

      if (techniques) {
        techniques.forEach(tech => {
          const tactic = tech.tactic?.toLowerCase().replace(/ /g, '-')

          // Find which phase this tactic belongs to
          const phase = KILL_CHAIN_PHASES.find(p => p.tactics.includes(tactic))
          if (phase) {
            const isUsed = actorTtps.includes(tech.technique_id)
            phaseData[phase.id].techniques.push({
              ...tech,
              isUsed,
            })
            if (isUsed) {
              phaseData[phase.id].count++
            }
          }
        })

        // Calculate intensity (0-1) based on technique usage
        const maxCount = Math.max(...Object.values(phaseData).map(p => p.count), 1)
        Object.values(phaseData).forEach(phase => {
          phase.intensity = phase.count / maxCount
        })
      }

      setTechniqueData(phaseData)
      setLoading(false)
    }

    fetchData()
  }, [actorId, days])

  const handlePhaseClick = (phase) => {
    if (onPhaseClick) {
      onPhaseClick(phase)
    }
    setSelectedPhase(selectedPhase?.id === phase.id ? null : phase)
  }

  // Get opacity based on intensity
  const getOpacity = (intensity) => {
    return 0.3 + (intensity * 0.7)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Chain Visualization */}
      <div className="flex items-center gap-1">
        {KILL_CHAIN_PHASES.map((phase, index) => {
          const data = techniqueData[phase.id]
          const isSelected = selectedPhase?.id === phase.id

          return (
            <div key={phase.id} className="flex items-center">
              {/* Phase Block */}
              <div
                className={`relative cursor-pointer transition-all ${
                  isSelected ? 'ring-2 ring-cyan-400 z-10' : ''
                }`}
                style={{
                  minWidth: 80,
                  flex: 1,
                }}
                onClick={() => handlePhaseClick(data)}
              >
                {/* Arrow shape */}
                <div
                  className="relative py-3 px-4 text-center"
                  style={{
                    backgroundColor: phase.color,
                    opacity: getOpacity(data?.intensity || 0),
                    clipPath: index === KILL_CHAIN_PHASES.length - 1
                      ? 'polygon(0 0, 95% 0, 100% 50%, 95% 100%, 0 100%, 5% 50%)'
                      : 'polygon(0 0, 95% 0, 100% 50%, 95% 100%, 0 100%, 5% 50%)',
                  }}
                >
                  <div className="text-white text-xs font-medium whitespace-nowrap">
                    {phase.shortName}
                  </div>
                  <div className="text-white/80 text-xs mt-0.5">
                    {data?.count || 0}
                  </div>
                </div>

                {/* Activity indicator */}
                {data?.intensity > 0 && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-1"
                    style={{
                      backgroundColor: phase.color,
                      width: `${data.intensity * 100}%`,
                    }}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Selected Phase Details */}
      {showDetails && selectedPhase && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-white font-medium">{selectedPhase.name}</h4>
              <p className="text-gray-400 text-sm">{selectedPhase.description}</p>
            </div>
            <div
              className="px-3 py-1 rounded text-sm font-medium"
              style={{ backgroundColor: `${selectedPhase.color}40`, color: selectedPhase.color }}
            >
              {selectedPhase.count} techniques used
            </div>
          </div>

          {/* Techniques in this phase */}
          {selectedPhase.techniques?.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs text-gray-500 uppercase tracking-wider">
                Active Techniques
              </h5>
              <div className="grid grid-cols-2 gap-2">
                {selectedPhase.techniques
                  .filter(t => t.isUsed)
                  .slice(0, 6)
                  .map(tech => (
                    <div
                      key={tech.technique_id}
                      className="bg-gray-900 rounded p-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-cyan-400 font-mono text-xs">
                          {tech.technique_id}
                        </span>
                      </div>
                      <div className="text-gray-300 text-sm truncate">
                        {tech.name}
                      </div>
                    </div>
                  ))}
              </div>
              {selectedPhase.techniques.filter(t => t.isUsed).length > 6 && (
                <div className="text-xs text-gray-500">
                  +{selectedPhase.techniques.filter(t => t.isUsed).length - 6} more
                </div>
              )}
            </div>
          )}

          {/* Defensive recommendations */}
          <div className="mt-4 pt-4 border-t border-gray-700">
            <h5 className="text-xs text-orange-400 uppercase tracking-wider mb-2">
              Defensive Focus
            </h5>
            <p className="text-sm text-gray-400">
              {selectedPhase.id === 'reconnaissance' && 'Minimize public exposure, monitor for port scanning, implement honeypots'}
              {selectedPhase.id === 'weaponization' && 'Keep threat intel current, update detection signatures, monitor dark web'}
              {selectedPhase.id === 'delivery' && 'Email filtering, user awareness training, block malicious domains'}
              {selectedPhase.id === 'exploitation' && 'Patch management, EDR deployment, application whitelisting'}
              {selectedPhase.id === 'installation' && 'Monitor autoruns, detect persistence mechanisms, audit scheduled tasks'}
              {selectedPhase.id === 'command-control' && 'Network monitoring, DNS filtering, block known C2 infrastructure'}
              {selectedPhase.id === 'actions' && 'Data loss prevention, backup verification, incident response readiness'}
            </p>
          </div>
        </div>
      )}

      {/* Stats Summary */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div>
          Most active: {
            Object.values(techniqueData)
              .sort((a, b) => b.count - a.count)[0]?.name || 'N/A'
          }
        </div>
        <div>
          Total techniques tracked: {
            Object.values(techniqueData).reduce((sum, p) => sum + p.count, 0)
          }
        </div>
      </div>
    </div>
  )
}

// Compact version for dashboard
export function KillChainMini({ actorId, onViewFull }) {
  return (
    <div className="cyber-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-white">Attack Kill Chain</h3>
        {onViewFull && (
          <button
            onClick={onViewFull}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            View Details
          </button>
        )}
      </div>
      <KillChainVisualization actorId={actorId} showDetails={false} />
    </div>
  )
}
