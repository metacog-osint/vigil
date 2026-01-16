import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../../lib/supabase'

// Simple force-directed graph implementation
function useForceSimulation(nodes, links, width, height) {
  const [positions, setPositions] = useState([])

  useEffect(() => {
    if (!nodes.length) return

    // Initialize positions
    const pos = nodes.map((node, i) => ({
      id: node.id,
      x: width / 2 + (Math.random() - 0.5) * width * 0.5,
      y: height / 2 + (Math.random() - 0.5) * height * 0.5,
      vx: 0,
      vy: 0,
      ...node,
    }))

    // Simple force simulation
    const simulate = () => {
      const alpha = 0.3
      const repulsion = 5000
      const attraction = 0.01
      const centerForce = 0.02

      // Apply forces
      pos.forEach((node, i) => {
        // Center force
        node.vx += (width / 2 - node.x) * centerForce
        node.vy += (height / 2 - node.y) * centerForce

        // Repulsion from other nodes
        pos.forEach((other, j) => {
          if (i === j) return
          const dx = node.x - other.x
          const dy = node.y - other.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = repulsion / (dist * dist)
          node.vx += (dx / dist) * force * alpha
          node.vy += (dy / dist) * force * alpha
        })
      })

      // Attraction from links
      links.forEach(link => {
        const source = pos.find(p => p.id === link.source)
        const target = pos.find(p => p.id === link.target)
        if (!source || !target) return

        const dx = target.x - source.x
        const dy = target.y - source.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = dist * attraction * (link.weight || 1)

        source.vx += dx * force * alpha
        source.vy += dy * force * alpha
        target.vx -= dx * force * alpha
        target.vy -= dy * force * alpha
      })

      // Update positions with damping
      pos.forEach(node => {
        node.vx *= 0.6
        node.vy *= 0.6
        node.x += node.vx
        node.y += node.vy

        // Keep in bounds
        node.x = Math.max(50, Math.min(width - 50, node.x))
        node.y = Math.max(50, Math.min(height - 50, node.y))
      })

      setPositions([...pos])
    }

    // Run simulation iterations
    const iterations = 100
    for (let i = 0; i < iterations; i++) {
      simulate()
    }

    setPositions([...pos])
  }, [nodes, links, width, height])

  return positions
}

// Calculate relationship score between two actors
function calculateRelationship(actor1, actor2) {
  let score = 0
  const reasons = []

  // Same type
  if (actor1.actor_type === actor2.actor_type) {
    score += 20
    reasons.push(`Same type: ${actor1.actor_type}`)
  }

  // Shared sectors
  const sharedSectors = actor1.target_sectors?.filter(
    s => actor2.target_sectors?.includes(s)
  ) || []
  if (sharedSectors.length > 0) {
    score += sharedSectors.length * 15
    reasons.push(`Shared sectors: ${sharedSectors.join(', ')}`)
  }

  // Shared TTPs
  const sharedTtps = actor1.ttps?.filter(t => actor2.ttps?.includes(t)) || []
  if (sharedTtps.length > 0) {
    score += sharedTtps.length * 10
    reasons.push(`${sharedTtps.length} shared TTPs`)
  }

  // Shared countries
  const sharedCountries = actor1.target_countries?.filter(
    c => actor2.target_countries?.includes(c)
  ) || []
  if (sharedCountries.length > 0) {
    score += sharedCountries.length * 5
    reasons.push(`${sharedCountries.length} shared target countries`)
  }

  return { score, reasons }
}

// Actor type colors
const TYPE_COLORS = {
  ransomware: '#ef4444',
  apt: '#8b5cf6',
  cybercrime: '#f97316',
  hacktivism: '#22c55e',
  initial_access_broker: '#eab308',
  data_extortion: '#ec4899',
  default: '#6b7280',
}

export default function ActorRelationshipGraph({
  focusActorId = null,
  limit = 30,
  minRelationshipScore = 30,
  height = 500,
  onActorClick,
}) {
  const [actors, setActors] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedActor, setSelectedActor] = useState(null)
  const [tooltip, setTooltip] = useState(null)
  const containerRef = useRef(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 })

  // Get container dimensions
  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setDimensions({ width: rect.width, height })
    }
  }, [height])

  // Fetch actors
  useEffect(() => {
    async function fetchData() {
      setLoading(true)

      let query = supabase
        .from('threat_actors')
        .select('id, name, actor_type, target_sectors, target_countries, ttps, trend_status, incidents_7d')
        .order('incidents_7d', { ascending: false, nullsFirst: false })
        .limit(limit)

      if (focusActorId) {
        // Get the focus actor and related ones
        const { data: focusActor } = await supabase
          .from('threat_actors')
          .select('*')
          .eq('id', focusActorId)
          .single()

        if (focusActor) {
          // Get actors with similar characteristics
          const { data } = await supabase
            .from('threat_actors')
            .select('id, name, actor_type, target_sectors, target_countries, ttps, trend_status, incidents_7d')
            .or(`actor_type.eq.${focusActor.actor_type},target_sectors.cs.{${focusActor.target_sectors?.[0] || ''}}`)
            .limit(limit)

          if (data) {
            setActors([focusActor, ...data.filter(a => a.id !== focusActorId)])
          }
        }
      } else {
        const { data } = await query
        if (data) {
          setActors(data)
        }
      }

      setLoading(false)
    }

    fetchData()
  }, [focusActorId, limit])

  // Calculate nodes and links
  const { nodes, links } = useMemo(() => {
    const nodeList = actors.map(actor => ({
      id: actor.id,
      name: actor.name,
      type: actor.actor_type,
      color: TYPE_COLORS[actor.actor_type?.toLowerCase()] || TYPE_COLORS.default,
      size: Math.min(Math.max((actor.incidents_7d || 0) * 2 + 15, 15), 40),
      trend: actor.trend_status,
      isFocus: actor.id === focusActorId,
      ...actor,
    }))

    const linkList = []
    const processedPairs = new Set()

    // Calculate relationships between all pairs
    actors.forEach((actor1, i) => {
      actors.forEach((actor2, j) => {
        if (i >= j) return
        const pairKey = [actor1.id, actor2.id].sort().join('-')
        if (processedPairs.has(pairKey)) return
        processedPairs.add(pairKey)

        const { score, reasons } = calculateRelationship(actor1, actor2)
        if (score >= minRelationshipScore) {
          linkList.push({
            source: actor1.id,
            target: actor2.id,
            weight: score / 100,
            score,
            reasons,
          })
        }
      })
    })

    return { nodes: nodeList, links: linkList }
  }, [actors, focusActorId, minRelationshipScore])

  // Run force simulation
  const positions = useForceSimulation(nodes, links, dimensions.width, dimensions.height)

  const handleNodeClick = (node) => {
    setSelectedActor(selectedActor?.id === node.id ? null : node)
    if (onActorClick) {
      onActorClick(node)
    }
  }

  const handleMouseEnter = (node, evt) => {
    setTooltip({
      ...node,
      x: evt.clientX,
      y: evt.clientY,
    })
  }

  const handleMouseLeave = () => {
    setTooltip(null)
  }

  // Get link for node
  const getNodeLinks = (nodeId) => {
    return links.filter(l => l.source === nodeId || l.target === nodeId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          {Object.entries(TYPE_COLORS).filter(([k]) => k !== 'default').map(([type, color]) => (
            <div key={type} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-gray-400 capitalize">{type.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
        <div className="text-gray-500">
          {nodes.length} actors • {links.length} relationships
        </div>
      </div>

      {/* Graph */}
      <div
        ref={containerRef}
        className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden"
        style={{ height }}
      >
        <svg width="100%" height="100%">
          {/* Links */}
          {links.map((link, i) => {
            const source = positions.find(p => p.id === link.source)
            const target = positions.find(p => p.id === link.target)
            if (!source || !target) return null

            const isHighlighted = selectedActor &&
              (link.source === selectedActor.id || link.target === selectedActor.id)

            return (
              <line
                key={i}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                stroke={isHighlighted ? '#06b6d4' : '#374151'}
                strokeWidth={isHighlighted ? 2 : 1}
                strokeOpacity={isHighlighted ? 0.8 : 0.3}
              />
            )
          })}

          {/* Nodes */}
          {positions.map((node) => {
            const isSelected = selectedActor?.id === node.id
            const isConnected = selectedActor &&
              getNodeLinks(selectedActor.id).some(l =>
                l.source === node.id || l.target === node.id
              )

            return (
              <g key={node.id}>
                {/* Glow effect for focus/selected */}
                {(node.isFocus || isSelected) && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.size + 5}
                    fill="none"
                    stroke={node.color}
                    strokeWidth={2}
                    strokeOpacity={0.5}
                  />
                )}

                {/* Node circle */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.size}
                  fill={node.color}
                  fillOpacity={selectedActor ? (isSelected || isConnected ? 1 : 0.3) : 0.8}
                  stroke={isSelected ? '#fff' : '#1f2937'}
                  strokeWidth={isSelected ? 2 : 1}
                  className="cursor-pointer transition-opacity"
                  onClick={() => handleNodeClick(node)}
                  onMouseEnter={(e) => handleMouseEnter(node, e)}
                  onMouseLeave={handleMouseLeave}
                />

                {/* Node label */}
                {node.size > 20 && (
                  <text
                    x={node.x}
                    y={node.y + node.size + 12}
                    textAnchor="middle"
                    fill="#9ca3af"
                    fontSize={10}
                    className="pointer-events-none"
                  >
                    {node.name.length > 12 ? node.name.substring(0, 12) + '...' : node.name}
                  </text>
                )}

                {/* Trend indicator */}
                {node.trend === 'ESCALATING' && (
                  <circle
                    cx={node.x + node.size * 0.7}
                    cy={node.y - node.size * 0.7}
                    r={5}
                    fill="#ef4444"
                  />
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Selected Actor Details */}
      {selectedActor && (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: selectedActor.color }}
              />
              <h4 className="text-white font-medium">{selectedActor.name}</h4>
              <span className="text-xs text-gray-500 capitalize">{selectedActor.type}</span>
            </div>
            <button
              onClick={() => setSelectedActor(null)}
              className="text-gray-500 hover:text-gray-300"
            >
              ×
            </button>
          </div>

          {/* Connections */}
          <div className="space-y-2">
            <h5 className="text-xs text-gray-500 uppercase tracking-wider">
              Related Actors ({getNodeLinks(selectedActor.id).length})
            </h5>
            <div className="grid grid-cols-2 gap-2">
              {getNodeLinks(selectedActor.id).map((link, i) => {
                const otherId = link.source === selectedActor.id ? link.target : link.source
                const other = positions.find(p => p.id === otherId)
                if (!other) return null

                return (
                  <div
                    key={i}
                    className="bg-gray-900 rounded p-2 cursor-pointer hover:bg-gray-850"
                    onClick={() => handleNodeClick(other)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: other.color }}
                      />
                      <span className="text-gray-300 text-sm">{other.name}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Score: {link.score} • {link.reasons?.[0]}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && !selectedActor && (
        <div
          className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-3 pointer-events-none"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y + 10,
            maxWidth: 200,
          }}
        >
          <div className="font-medium text-white mb-1">{tooltip.name}</div>
          <div className="text-xs text-gray-400 capitalize mb-2">{tooltip.type}</div>
          {tooltip.target_sectors?.length > 0 && (
            <div className="text-xs text-gray-500">
              Targets: {tooltip.target_sectors.slice(0, 3).join(', ')}
            </div>
          )}
          {tooltip.incidents_7d > 0 && (
            <div className="text-xs text-cyan-400 mt-1">
              {tooltip.incidents_7d} incidents (7d)
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Compact version
export function ActorGraphMini({ onViewFull }) {
  return (
    <div className="cyber-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-white">Actor Relationships</h3>
        {onViewFull && (
          <button
            onClick={onViewFull}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            Expand
          </button>
        )}
      </div>
      <ActorRelationshipGraph limit={15} height={250} />
    </div>
  )
}
