/**
 * EntityRelationshipGraph Component
 * Visualizes relationships between threat actors, incidents, IOCs, and vulnerabilities
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'

// Entity type configurations
const ENTITY_CONFIGS = {
  actor: {
    color: '#A855F7',
    bgColor: 'bg-purple-500',
    textColor: 'text-purple-400',
    icon: '🎭',
    label: 'Threat Actor',
  },
  incident: {
    color: '#F97316',
    bgColor: 'bg-orange-500',
    textColor: 'text-orange-400',
    icon: '⚡',
    label: 'Incident',
  },
  ioc: {
    color: '#22D3EE',
    bgColor: 'bg-cyan-500',
    textColor: 'text-cyan-400',
    icon: '🔍',
    label: 'IOC',
  },
  vulnerability: {
    color: '#EF4444',
    bgColor: 'bg-red-500',
    textColor: 'text-red-400',
    icon: '🛡️',
    label: 'Vulnerability',
  },
  malware: {
    color: '#EC4899',
    bgColor: 'bg-pink-500',
    textColor: 'text-pink-400',
    icon: '🦠',
    label: 'Malware',
  },
  technique: {
    color: '#10B981',
    bgColor: 'bg-emerald-500',
    textColor: 'text-emerald-400',
    icon: '⚔️',
    label: 'Technique',
  },
}

// Relationship types
const RELATIONSHIP_TYPES = {
  attributed_to: { label: 'Attributed to', style: 'solid' },
  uses: { label: 'Uses', style: 'solid' },
  targets: { label: 'Targets', style: 'dashed' },
  exploits: { label: 'Exploits', style: 'solid' },
  indicates: { label: 'Indicates', style: 'dashed' },
  related_to: { label: 'Related to', style: 'dotted' },
  part_of: { label: 'Part of', style: 'solid' },
}

// Layout algorithms
function circularLayout(nodes, centerX, centerY, radius) {
  const angleStep = (2 * Math.PI) / nodes.length
  return nodes.map((node, i) => ({
    ...node,
    x: centerX + radius * Math.cos(angleStep * i - Math.PI / 2),
    y: centerY + radius * Math.sin(angleStep * i - Math.PI / 2),
  }))
}

function hierarchicalLayout(nodes, relationships, width, height) {
  // Group nodes by type
  const groups = {}
  nodes.forEach((node) => {
    if (!groups[node.type]) groups[node.type] = []
    groups[node.type].push(node)
  })

  const typeOrder = ['actor', 'incident', 'ioc', 'vulnerability', 'malware', 'technique']
  const presentTypes = typeOrder.filter((t) => groups[t]?.length > 0)

  const rowHeight = height / (presentTypes.length + 1)

  presentTypes.forEach((type, rowIndex) => {
    const nodesInRow = groups[type] || []
    const colWidth = width / (nodesInRow.length + 1)

    nodesInRow.forEach((node, colIndex) => {
      node.x = colWidth * (colIndex + 1)
      node.y = rowHeight * (rowIndex + 1)
    })
  })

  return nodes
}

// Entity Node Component
function EntityNode({ node, isSelected, isHighlighted, isExpanded, onClick, onExpand }) {
  const config = ENTITY_CONFIGS[node.type] || ENTITY_CONFIGS.ioc
  const size = isExpanded ? 60 : 40

  return (
    <g
      transform={`translate(${node.x - size / 2},${node.y - size / 2})`}
      className="cursor-pointer"
      onClick={() => onClick?.(node)}
    >
      {/* Selection ring */}
      {isSelected && (
        <rect
          x="-4"
          y="-4"
          width={size + 8}
          height={size + 8}
          rx="8"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2"
        />
      )}

      {/* Node background */}
      <rect
        width={size}
        height={size}
        rx="6"
        fill={config.color}
        opacity={isHighlighted !== false ? 0.9 : 0.3}
        stroke={isSelected ? '#FFFFFF' : 'none'}
        strokeWidth="2"
      />

      {/* Icon */}
      <text
        x={size / 2}
        y={size / 2 + 6}
        textAnchor="middle"
        fontSize={isExpanded ? '24' : '18'}
        opacity={isHighlighted !== false ? 1 : 0.4}
      >
        {config.icon}
      </text>

      {/* Label */}
      <text
        x={size / 2}
        y={size + 14}
        textAnchor="middle"
        fill="#9CA3AF"
        fontSize="10"
        opacity={isHighlighted !== false ? 1 : 0.4}
      >
        {(node.label || node.name)?.slice(0, 15) || 'Unknown'}
      </text>

      {/* Expand button */}
      {node.hasRelationships && (
        <circle
          cx={size}
          cy="0"
          r="8"
          fill="#374151"
          stroke="#6B7280"
          strokeWidth="1"
          onClick={(e) => {
            e.stopPropagation()
            onExpand?.(node)
          }}
        />
      )}
    </g>
  )
}

// Relationship Edge Component
function RelationshipEdge({ relationship, sourceNode, targetNode, isHighlighted }) {
  if (!sourceNode || !targetNode) return null

  const relConfig = RELATIONSHIP_TYPES[relationship.type] || RELATIONSHIP_TYPES.related_to

  // Calculate path
  const midX = (sourceNode.x + targetNode.x) / 2
  const midY = (sourceNode.y + targetNode.y) / 2

  // Slight curve for better visibility
  const dx = targetNode.x - sourceNode.x
  const dy = targetNode.y - sourceNode.y
  const curveOffset = Math.min(30, Math.sqrt(dx * dx + dy * dy) / 10)

  const path = `M ${sourceNode.x} ${sourceNode.y} Q ${midX + curveOffset} ${midY - curveOffset} ${targetNode.x} ${targetNode.y}`

  return (
    <g opacity={isHighlighted !== false ? 0.7 : 0.15}>
      {/* Edge line */}
      <path
        d={path}
        fill="none"
        stroke="#6B7280"
        strokeWidth={relationship.weight || 1}
        strokeDasharray={
          relConfig.style === 'dashed' ? '8,4' : relConfig.style === 'dotted' ? '2,2' : undefined
        }
        markerEnd="url(#arrowhead)"
      />

      {/* Label */}
      <text
        x={midX + curveOffset / 2}
        y={midY - curveOffset / 2 - 4}
        textAnchor="middle"
        fill="#6B7280"
        fontSize="8"
      >
        {relConfig.label}
      </text>
    </g>
  )
}

// Legend Component
function GraphLegend({ onTypeFilter, activeTypes }) {
  return (
    <div className="absolute top-2 right-2 bg-gray-800/95 rounded-lg p-3 border border-gray-700 space-y-2">
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Entity Types</div>
      {Object.entries(ENTITY_CONFIGS).map(([type, config]) => (
        <button
          key={type}
          onClick={() => onTypeFilter(type)}
          className={`flex items-center gap-2 w-full px-2 py-1 rounded text-left text-xs transition-colors ${
            activeTypes.includes(type)
              ? 'bg-gray-700 text-white'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <span>{config.icon}</span>
          <span>{config.label}</span>
        </button>
      ))}
    </div>
  )
}

// Search/Filter Bar
function GraphControls({ onSearch, onLayoutChange, layout }) {
  const [searchTerm, setSearchTerm] = useState('')

  const handleSearch = (e) => {
    setSearchTerm(e.target.value)
    onSearch(e.target.value)
  }

  return (
    <div className="absolute top-2 left-2 flex gap-2 z-10">
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={handleSearch}
          placeholder="Search entities..."
          className="pl-8 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 w-48 focus:outline-none focus:border-cyan-500"
        />
      </div>

      <select
        value={layout}
        onChange={(e) => onLayoutChange(e.target.value)}
        className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm text-white"
      >
        <option value="hierarchical">Hierarchical</option>
        <option value="circular">Circular</option>
        <option value="force">Force-Directed</option>
      </select>
    </div>
  )
}

// Details Panel
function EntityDetailsPanel({ entity, onClose, onNavigate }) {
  if (!entity) return null

  const config = ENTITY_CONFIGS[entity.type] || ENTITY_CONFIGS.ioc

  return (
    <div className="absolute bottom-2 left-2 right-2 bg-gray-800/95 rounded-lg border border-gray-700 p-4 max-h-48 overflow-auto">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`${config.bgColor}/20 p-1.5 rounded`}>
            <span>{config.icon}</span>
          </span>
          <div>
            <div className="text-sm font-medium text-white">{entity.label || entity.name}</div>
            <div className={`text-xs ${config.textColor}`}>{config.label}</div>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          ✕
        </button>
      </div>

      {entity.metadata && (
        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
          {entity.metadata.trend_status && (
            <div>
              <span className="text-gray-500">Trend:</span>
              <span className="ml-1 text-gray-300">{entity.metadata.trend_status}</span>
            </div>
          )}
          {entity.metadata.incidents_7d !== undefined && (
            <div>
              <span className="text-gray-500">Incidents (7d):</span>
              <span className="ml-1 text-gray-300">{entity.metadata.incidents_7d}</span>
            </div>
          )}
          {entity.metadata.cvss_score !== undefined && (
            <div>
              <span className="text-gray-500">CVSS:</span>
              <span className="ml-1 text-gray-300">{entity.metadata.cvss_score}</span>
            </div>
          )}
        </div>
      )}

      {entity.relationships?.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-1">
            Relationships ({entity.relationships.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {entity.relationships.slice(0, 5).map((rel, i) => (
              <button
                key={i}
                onClick={() => onNavigate?.(rel.targetId)}
                className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300 hover:bg-gray-600"
              >
                {rel.type}: {rel.targetLabel}
              </button>
            ))}
            {entity.relationships.length > 5 && (
              <span className="text-xs text-gray-500">+{entity.relationships.length - 5} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Main EntityRelationshipGraph Component
export default function EntityRelationshipGraph({
  entities = [],
  relationships = [],
  onEntityClick,
  onEntitySelect,
  selectedEntityId,
  height = 500,
  showLegend = true,
  showControls = true,
  initialLayout = 'hierarchical',
}) {
  const [layout, setLayout] = useState(initialLayout)
  const [activeTypes, setActiveTypes] = useState(Object.keys(ENTITY_CONFIGS))
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEntity, setSelectedEntity] = useState(null)
  const [hoveredEntity, _setHoveredEntity] = useState(null)
  const [layoutNodes, setLayoutNodes] = useState([])

  const width = 800 // SVG width

  // Filter entities
  const filteredEntities = useMemo(() => {
    return entities.filter((e) => {
      const matchesType = activeTypes.includes(e.type)
      const matchesSearch =
        !searchTerm || (e.label || e.name || '').toLowerCase().includes(searchTerm.toLowerCase())
      return matchesType && matchesSearch
    })
  }, [entities, activeTypes, searchTerm])

  // Apply layout
  useEffect(() => {
    if (filteredEntities.length === 0) {
      setLayoutNodes([])
      return
    }

    let positioned
    switch (layout) {
      case 'circular':
        positioned = circularLayout(
          [...filteredEntities],
          width / 2,
          height / 2,
          Math.min(width, height) / 3
        )
        break
      case 'hierarchical':
      default:
        positioned = hierarchicalLayout([...filteredEntities], relationships, width, height)
        break
    }

    setLayoutNodes(positioned)
  }, [filteredEntities, relationships, layout, width, height])

  // Node map for relationship rendering
  const nodeMap = useMemo(() => {
    return new Map(layoutNodes.map((n) => [n.id, n]))
  }, [layoutNodes])

  // Filter relationships to visible entities
  const visibleRelationships = useMemo(() => {
    const entityIds = new Set(layoutNodes.map((n) => n.id))
    return relationships.filter((r) => entityIds.has(r.sourceId) && entityIds.has(r.targetId))
  }, [relationships, layoutNodes])

  // Handle entity click
  const handleEntityClick = useCallback(
    (entity) => {
      setSelectedEntity(entity)
      onEntityClick?.(entity)
      onEntitySelect?.(entity.id)
    },
    [onEntityClick, onEntitySelect]
  )

  // Toggle type filter
  const handleTypeFilter = useCallback((type) => {
    setActiveTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }, [])

  // Get connected entity IDs for highlighting
  const connectedIds = useMemo(() => {
    const focusId = (selectedEntity || hoveredEntity)?.id
    if (!focusId) return new Set()

    const connected = new Set([focusId])
    visibleRelationships.forEach((r) => {
      if (r.sourceId === focusId) connected.add(r.targetId)
      if (r.targetId === focusId) connected.add(r.sourceId)
    })
    return connected
  }, [selectedEntity, hoveredEntity, visibleRelationships])

  const shouldHighlight = connectedIds.size > 0

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ height }}>
      {/* Controls */}
      {showControls && (
        <GraphControls onSearch={setSearchTerm} onLayoutChange={setLayout} layout={layout} />
      )}

      {/* SVG Canvas */}
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
        {/* Arrow marker */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#6B7280" />
          </marker>
        </defs>

        {/* Relationships */}
        {visibleRelationships.map((rel, i) => (
          <RelationshipEdge
            key={`rel-${i}`}
            relationship={rel}
            sourceNode={nodeMap.get(rel.sourceId)}
            targetNode={nodeMap.get(rel.targetId)}
            isHighlighted={
              !shouldHighlight || (connectedIds.has(rel.sourceId) && connectedIds.has(rel.targetId))
            }
          />
        ))}

        {/* Entities */}
        {layoutNodes.map((entity) => (
          <EntityNode
            key={entity.id}
            node={entity}
            isSelected={selectedEntity?.id === entity.id || selectedEntityId === entity.id}
            isHighlighted={!shouldHighlight || connectedIds.has(entity.id)}
            onClick={handleEntityClick}
          />
        ))}
      </svg>

      {/* Legend */}
      {showLegend && <GraphLegend onTypeFilter={handleTypeFilter} activeTypes={activeTypes} />}

      {/* Details Panel */}
      {selectedEntity && (
        <EntityDetailsPanel
          entity={selectedEntity}
          onClose={() => setSelectedEntity(null)}
          onNavigate={(id) => {
            const node = nodeMap.get(id)
            if (node) handleEntityClick(node)
          }}
        />
      )}

      {/* Empty state */}
      {layoutNodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
          No entities to display
        </div>
      )}

      {/* Stats */}
      <div className="absolute bottom-2 right-2 text-xs text-gray-500">
        {layoutNodes.length} entities • {visibleRelationships.length} relationships
      </div>
    </div>
  )
}

export { ENTITY_CONFIGS, RELATIONSHIP_TYPES, circularLayout, hierarchicalLayout }
