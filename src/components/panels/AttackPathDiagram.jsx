import { useState, useEffect } from 'react'
import { correlations } from '../../lib/supabase'

/**
 * AttackPathDiagram - Visual attack chain showing Actor → Technique → Vulnerability → IOC flow
 */
export function AttackPathDiagram({ actorId, actorName, className = '' }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState(null)

  useEffect(() => {
    if (actorId) {
      loadCorrelationData()
    }
  }, [actorId])

  async function loadCorrelationData() {
    setLoading(true)
    try {
      const result = await correlations.getActorCorrelations(actorId)
      setData(result)
    } catch (error) {
      console.error('Error loading attack path:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={`animate-pulse bg-gray-800/50 rounded-lg p-4 ${className}`}>
        <div className="h-48 flex items-center justify-center text-gray-500">
          Loading attack path...
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className={`bg-gray-800/30 rounded-lg p-4 ${className}`}>
        <div className="h-48 flex items-center justify-center text-gray-500">
          No correlation data available
        </div>
      </div>
    )
  }

  const techniques = data.techniques || []
  const vulnerabilities = data.vulnerabilities || []
  const iocs = data.iocs || []

  // Group IOCs by type
  const iocsByType = iocs.reduce((acc, ioc) => {
    const type = ioc.type || 'unknown'
    if (!acc[type]) acc[type] = []
    acc[type].push(ioc)
    return acc
  }, {})

  return (
    <div className={`bg-gray-800/30 rounded-lg p-4 ${className}`}>
      <div className="text-sm text-gray-400 mb-4">Attack Path for {actorName}</div>

      {/* Flow Diagram */}
      <div className="relative">
        {/* SVG Connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#4b5563" />
            </marker>
          </defs>
        </svg>

        {/* Nodes Grid */}
        <div className="grid grid-cols-4 gap-4 relative z-10">
          {/* Actor Node */}
          <div className="flex flex-col items-center">
            <div className="text-xs text-gray-500 mb-2">ACTOR</div>
            <NodeBox
              type="actor"
              label={actorName}
              isSelected={selectedNode?.type === 'actor'}
              onClick={() => setSelectedNode({ type: 'actor', name: actorName })}
            />
          </div>

          {/* Techniques Column */}
          <div className="flex flex-col items-center">
            <div className="text-xs text-gray-500 mb-2">TECHNIQUES</div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {techniques.slice(0, 5).map((tech) => (
                <NodeBox
                  key={tech.id}
                  type="technique"
                  label={tech.id}
                  sublabel={tech.name}
                  isSelected={selectedNode?.id === tech.id}
                  onClick={() => setSelectedNode({ type: 'technique', ...tech })}
                />
              ))}
              {techniques.length > 5 && (
                <div className="text-xs text-gray-500 text-center">
                  +{techniques.length - 5} more
                </div>
              )}
              {techniques.length === 0 && (
                <div className="text-xs text-gray-600 text-center py-2">None linked</div>
              )}
            </div>
          </div>

          {/* Vulnerabilities Column */}
          <div className="flex flex-col items-center">
            <div className="text-xs text-gray-500 mb-2">VULNERABILITIES</div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {vulnerabilities.slice(0, 5).map((vuln) => (
                <NodeBox
                  key={vuln.cve_id}
                  type="vulnerability"
                  label={vuln.cve_id}
                  sublabel={vuln.confidence}
                  isSelected={selectedNode?.cve_id === vuln.cve_id}
                  onClick={() => setSelectedNode({ type: 'vulnerability', ...vuln })}
                />
              ))}
              {vulnerabilities.length > 5 && (
                <div className="text-xs text-gray-500 text-center">
                  +{vulnerabilities.length - 5} more
                </div>
              )}
              {vulnerabilities.length === 0 && (
                <div className="text-xs text-gray-600 text-center py-2">None linked</div>
              )}
            </div>
          </div>

          {/* IOCs Column */}
          <div className="flex flex-col items-center">
            <div className="text-xs text-gray-500 mb-2">IOCs</div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {Object.entries(iocsByType)
                .slice(0, 3)
                .map(([type, items]) => (
                  <NodeBox
                    key={type}
                    type="ioc"
                    label={`${items.length} ${type}`}
                    sublabel={items[0]?.value?.slice(0, 20)}
                    isSelected={selectedNode?.type === 'ioc' && selectedNode?.iocType === type}
                    onClick={() => setSelectedNode({ type: 'ioc', iocType: type, items })}
                  />
                ))}
              {Object.keys(iocsByType).length === 0 && (
                <div className="text-xs text-gray-600 text-center py-2">None linked</div>
              )}
            </div>
          </div>
        </div>

        {/* Flow Arrows */}
        <div
          className="absolute top-1/2 left-0 right-0 flex justify-around items-center -translate-y-1/2 pointer-events-none"
          style={{ zIndex: 5 }}
        >
          <FlowArrow />
          <FlowArrow />
          <FlowArrow />
        </div>
      </div>

      {/* Selected Node Details */}
      {selectedNode && (
        <div className="mt-4 p-3 bg-gray-900/50 rounded border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase">{selectedNode.type}</span>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-gray-500 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <NodeDetails node={selectedNode} />
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-700 flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-500/30 border border-red-500"></span>
          <span>Actor</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-purple-500/30 border border-purple-500"></span>
          <span>Technique</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-orange-500/30 border border-orange-500"></span>
          <span>Vulnerability</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-cyan-500/30 border border-cyan-500"></span>
          <span>IOC</span>
        </div>
      </div>
    </div>
  )
}

// Node box component
function NodeBox({ type, label, sublabel, isSelected, onClick }) {
  const colors = {
    actor: 'border-red-500 bg-red-500/10 text-red-400',
    technique: 'border-purple-500 bg-purple-500/10 text-purple-400',
    vulnerability: 'border-orange-500 bg-orange-500/10 text-orange-400',
    ioc: 'border-cyan-500 bg-cyan-500/10 text-cyan-400',
  }

  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded border text-xs font-mono transition-all w-full text-left ${colors[type]} ${
        isSelected ? 'ring-2 ring-white/30' : 'hover:brightness-125'
      }`}
    >
      <div className="truncate">{label}</div>
      {sublabel && <div className="text-[10px] text-gray-500 truncate mt-0.5">{sublabel}</div>}
    </button>
  )
}

// Flow arrow component
function FlowArrow() {
  return (
    <div className="flex items-center text-gray-600">
      <div className="w-8 h-0.5 bg-gray-600"></div>
      <svg className="w-3 h-3 -ml-1" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  )
}

// Node details component
function NodeDetails({ node }) {
  switch (node.type) {
    case 'actor':
      return <div className="text-white font-medium">{node.name}</div>

    case 'technique':
      return (
        <div className="space-y-1">
          <div className="text-white font-medium">
            {node.id}: {node.name}
          </div>
          {node.tactics && (
            <div className="text-gray-400 text-xs">Tactics: {node.tactics.join(', ')}</div>
          )}
          {node.notes && <div className="text-gray-500 text-xs">{node.notes}</div>}
        </div>
      )

    case 'vulnerability':
      return (
        <div className="space-y-1">
          <div className="text-white font-medium">{node.cve_id}</div>
          <div className="text-gray-400 text-xs">Confidence: {node.confidence}</div>
          {node.notes && <div className="text-gray-500 text-xs">{node.notes}</div>}
          {node.source && <div className="text-gray-500 text-xs">Source: {node.source}</div>}
        </div>
      )

    case 'ioc':
      return (
        <div className="space-y-1">
          <div className="text-white font-medium">
            {node.items?.length} {node.iocType} IOCs
          </div>
          <div className="text-xs text-gray-400 space-y-0.5 max-h-32 overflow-y-auto">
            {node.items?.slice(0, 5).map((ioc, i) => (
              <div key={i} className="font-mono truncate">
                {ioc.value}
              </div>
            ))}
            {node.items?.length > 5 && (
              <div className="text-gray-500">+{node.items.length - 5} more</div>
            )}
          </div>
        </div>
      )

    default:
      return null
  }
}

/**
 * AttackPathMini - Compact version showing just counts
 */
export function AttackPathMini({ actorId, className = '' }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (actorId) {
      loadData()
    }
  }, [actorId])

  async function loadData() {
    try {
      const result = await correlations.getActorCorrelations(actorId)
      setData(result)
    } catch (error) {
      console.error('Error loading attack path mini:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="animate-pulse h-8 bg-gray-800/50 rounded" />
  }

  if (!data) {
    return null
  }

  return (
    <div className={`flex items-center gap-3 text-xs ${className}`}>
      <div className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
        <span className="text-gray-400">{data.techniques?.length || 0} TTPs</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-orange-500"></span>
        <span className="text-gray-400">{data.vulnerabilities?.length || 0} CVEs</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
        <span className="text-gray-400">{data.iocs?.length || 0} IOCs</span>
      </div>
    </div>
  )
}

export default AttackPathDiagram
