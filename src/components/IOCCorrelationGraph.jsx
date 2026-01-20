/**
 * IOCCorrelationGraph Component
 * Visualizes relationships between IOCs, actors, and malware
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'

// Node type configurations
const NODE_TYPES = {
  ioc: {
    color: '#22D3EE', // cyan
    radius: 8,
    label: 'IOC',
  },
  actor: {
    color: '#A855F7', // purple
    radius: 12,
    label: 'Actor',
  },
  malware: {
    color: '#F97316', // orange
    radius: 10,
    label: 'Malware',
  },
  campaign: {
    color: '#EF4444', // red
    radius: 11,
    label: 'Campaign',
  },
  vulnerability: {
    color: '#EAB308', // yellow
    radius: 9,
    label: 'Vulnerability',
  },
}

// IOC subtype colors
const IOC_SUBTYPES = {
  ip: '#22D3EE',
  domain: '#10B981',
  url: '#3B82F6',
  hash: '#8B5CF6',
  email: '#EC4899',
}

// Edge type configurations
const EDGE_TYPES = {
  uses: { color: '#6B7280', width: 1, dashed: false, label: 'uses' },
  associated_with: { color: '#9CA3AF', width: 1, dashed: true, label: 'associated' },
  part_of: { color: '#F59E0B', width: 2, dashed: false, label: 'part of' },
  exploits: { color: '#EF4444', width: 2, dashed: false, label: 'exploits' },
  targets: { color: '#A855F7', width: 1, dashed: true, label: 'targets' },
}

// Simple force-directed layout
function forceDirectedLayout(nodes, edges, iterations = 100) {
  const width = 600
  const height = 400

  // Initialize positions randomly
  nodes.forEach((node, _i) => {
    if (node.x === undefined) {
      node.x = Math.random() * width
      node.y = Math.random() * height
    }
    node.vx = 0
    node.vy = 0
  })

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const n1 = nodes[i]
        const n2 = nodes[j]
        const dx = n2.x - n1.x
        const dy = n2.y - n1.y
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
        const force = 5000 / (dist * dist)

        n1.vx -= (dx / dist) * force
        n1.vy -= (dy / dist) * force
        n2.vx += (dx / dist) * force
        n2.vy += (dy / dist) * force
      }
    }

    // Attraction along edges
    edges.forEach((edge) => {
      const source = nodeMap.get(edge.source)
      const target = nodeMap.get(edge.target)
      if (!source || !target) return

      const dx = target.x - source.x
      const dy = target.y - source.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const force = dist * 0.01

      source.vx += (dx / dist) * force
      source.vy += (dy / dist) * force
      target.vx -= (dx / dist) * force
      target.vy -= (dy / dist) * force
    })

    // Center gravity
    nodes.forEach((node) => {
      node.vx += (width / 2 - node.x) * 0.001
      node.vy += (height / 2 - node.y) * 0.001
    })

    // Apply velocities with damping
    const damping = 0.9
    nodes.forEach((node) => {
      node.x += node.vx * damping
      node.y += node.vy * damping
      node.vx *= 0.9
      node.vy *= 0.9

      // Keep in bounds
      node.x = Math.max(30, Math.min(width - 30, node.x))
      node.y = Math.max(30, Math.min(height - 30, node.y))
    })
  }

  return { nodes, edges }
}

// Graph Node Component
function GraphNode({ node, isSelected, isHighlighted, onClick }) {
  const config = NODE_TYPES[node.type] || NODE_TYPES.ioc
  const subColor = node.type === 'ioc' ? IOC_SUBTYPES[node.subtype] : null
  const color = subColor || config.color
  const radius = config.radius

  return (
    <g
      transform={`translate(${node.x},${node.y})`}
      onClick={() => onClick?.(node)}
      style={{ cursor: 'pointer' }}
    >
      {/* Highlight ring */}
      {(isSelected || isHighlighted) && (
        <circle
          r={radius + 4}
          fill="none"
          stroke={isSelected ? '#FFFFFF' : color}
          strokeWidth="2"
          opacity="0.6"
        />
      )}

      {/* Node circle */}
      <circle
        r={radius}
        fill={color}
        stroke="#1F2937"
        strokeWidth="2"
        opacity={isHighlighted !== false ? 1 : 0.3}
      />

      {/* Node label */}
      <text
        y={radius + 14}
        textAnchor="middle"
        fill="#9CA3AF"
        fontSize="10"
        opacity={isHighlighted !== false ? 1 : 0.3}
      >
        {node.label?.slice(0, 20) || node.id.slice(0, 10)}
      </text>
    </g>
  )
}

// Graph Edge Component
function GraphEdge({ edge, sourceNode, targetNode, isHighlighted }) {
  const config = EDGE_TYPES[edge.type] || EDGE_TYPES.associated_with

  if (!sourceNode || !targetNode) return null

  return (
    <line
      x1={sourceNode.x}
      y1={sourceNode.y}
      x2={targetNode.x}
      y2={targetNode.y}
      stroke={config.color}
      strokeWidth={config.width}
      strokeDasharray={config.dashed ? '4,4' : undefined}
      opacity={isHighlighted !== false ? 0.6 : 0.1}
    />
  )
}

// Legend Component
function GraphLegend({ visibleTypes, onToggleType }) {
  return (
    <div className="absolute top-2 right-2 bg-gray-800/90 rounded p-2 space-y-1 text-xs">
      <div className="text-gray-400 font-medium mb-1">Legend</div>
      {Object.entries(NODE_TYPES).map(([type, config]) => (
        <button
          key={type}
          onClick={() => onToggleType(type)}
          className={`flex items-center gap-2 w-full px-1 py-0.5 rounded hover:bg-gray-700 ${
            visibleTypes.includes(type) ? 'opacity-100' : 'opacity-40'
          }`}
        >
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }} />
          <span className="text-gray-300">{config.label}</span>
        </button>
      ))}
    </div>
  )
}

// Node Details Panel
function NodeDetailsPanel({ node, onClose }) {
  if (!node) return null

  return (
    <div className="absolute bottom-2 left-2 right-2 bg-gray-800/95 rounded-lg p-3 border border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: NODE_TYPES[node.type]?.color }}
          />
          <span className="text-sm font-medium text-white">
            {NODE_TYPES[node.type]?.label || 'Unknown'}
          </span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          ✕
        </button>
      </div>
      <div className="text-sm text-gray-300 truncate">{node.label || node.id}</div>
      {node.metadata && (
        <div className="mt-2 text-xs text-gray-400 space-y-1">
          {node.metadata.source && <div>Source: {node.metadata.source}</div>}
          {node.metadata.confidence && <div>Confidence: {node.metadata.confidence}%</div>}
          {node.metadata.first_seen && (
            <div>First seen: {new Date(node.metadata.first_seen).toLocaleDateString()}</div>
          )}
        </div>
      )}
    </div>
  )
}

// Main IOCCorrelationGraph Component
export default function IOCCorrelationGraph({
  data = { nodes: [], edges: [] },
  onNodeClick,
  onNodeSelect,
  selectedNodeId,
  height = 400,
  showLegend = true,
  showControls = true,
}) {
  const svgRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [visibleTypes, setVisibleTypes] = useState(Object.keys(NODE_TYPES))
  const [selectedNode, setSelectedNode] = useState(null)
  const [hoveredNode, _setHoveredNode] = useState(null)
  const [layoutData, setLayoutData] = useState({ nodes: [], edges: [] })

  // Apply layout when data changes
  useEffect(() => {
    if (data.nodes.length === 0) {
      setLayoutData({ nodes: [], edges: [] })
      return
    }

    const layout = forceDirectedLayout([...data.nodes], [...data.edges])
    setLayoutData(layout)
  }, [data])

  // Filter visible nodes
  const visibleNodes = useMemo(() => {
    return layoutData.nodes.filter((n) => visibleTypes.includes(n.type))
  }, [layoutData.nodes, visibleTypes])

  const visibleNodeIds = useMemo(() => {
    return new Set(visibleNodes.map((n) => n.id))
  }, [visibleNodes])

  // Filter visible edges
  const visibleEdges = useMemo(() => {
    return layoutData.edges.filter(
      (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
    )
  }, [layoutData.edges, visibleNodeIds])

  // Node map for edge rendering
  const nodeMap = useMemo(() => {
    return new Map(visibleNodes.map((n) => [n.id, n]))
  }, [visibleNodes])

  // Handle node click
  const handleNodeClick = useCallback(
    (node) => {
      setSelectedNode(node)
      onNodeClick?.(node)
      onNodeSelect?.(node.id)
    },
    [onNodeClick, onNodeSelect]
  )

  // Toggle node type visibility
  const handleToggleType = useCallback((type) => {
    setVisibleTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }, [])

  // Reset view
  const handleReset = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setSelectedNode(null)
  }, [])

  // Get connected nodes for highlighting
  const connectedNodeIds = useMemo(() => {
    if (!selectedNode && !hoveredNode) return new Set()
    const focusId = (selectedNode || hoveredNode)?.id
    const connected = new Set([focusId])

    visibleEdges.forEach((e) => {
      if (e.source === focusId) connected.add(e.target)
      if (e.target === focusId) connected.add(e.source)
    })

    return connected
  }, [selectedNode, hoveredNode, visibleEdges])

  const shouldHighlight = connectedNodeIds.size > 0

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ height }}>
      {/* Controls */}
      {showControls && (
        <div className="absolute top-2 left-2 flex gap-1 z-10">
          <button
            onClick={() => setZoom((z) => Math.min(z + 0.2, 3))}
            className="p-1.5 bg-gray-800 rounded hover:bg-gray-700"
            title="Zoom in"
          >
            <MagnifyingGlassPlusIcon className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.2, 0.5))}
            className="p-1.5 bg-gray-800 rounded hover:bg-gray-700"
            title="Zoom out"
          >
            <MagnifyingGlassMinusIcon className="w-4 h-4 text-gray-400" />
          </button>
          <button
            onClick={handleReset}
            className="p-1.5 bg-gray-800 rounded hover:bg-gray-700"
            title="Reset view"
          >
            <ArrowPathIcon className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      )}

      {/* SVG Graph */}
      <svg ref={svgRef} width="100%" height="100%" className="cursor-move">
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {visibleEdges.map((edge, i) => (
            <GraphEdge
              key={`edge-${i}`}
              edge={edge}
              sourceNode={nodeMap.get(edge.source)}
              targetNode={nodeMap.get(edge.target)}
              isHighlighted={
                !shouldHighlight ||
                (connectedNodeIds.has(edge.source) && connectedNodeIds.has(edge.target))
              }
            />
          ))}

          {/* Nodes */}
          {visibleNodes.map((node) => (
            <GraphNode
              key={node.id}
              node={node}
              isSelected={selectedNode?.id === node.id || selectedNodeId === node.id}
              isHighlighted={!shouldHighlight || connectedNodeIds.has(node.id)}
              onClick={handleNodeClick}
            />
          ))}
        </g>
      </svg>

      {/* Legend */}
      {showLegend && <GraphLegend visibleTypes={visibleTypes} onToggleType={handleToggleType} />}

      {/* Node Details */}
      {selectedNode && (
        <NodeDetailsPanel node={selectedNode} onClose={() => setSelectedNode(null)} />
      )}

      {/* Empty state */}
      {visibleNodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
          No correlation data to display
        </div>
      )}

      {/* Stats */}
      <div className="absolute bottom-2 right-2 text-xs text-gray-500">
        {visibleNodes.length} nodes • {visibleEdges.length} edges
      </div>
    </div>
  )
}

export { NODE_TYPES, IOC_SUBTYPES, EDGE_TYPES, forceDirectedLayout }
