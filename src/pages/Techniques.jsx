// MITRE ATT&CK Techniques browser
import { useState, useEffect } from 'react'
import { techniques as techniquesApi, supabase } from '../lib/supabase'
import { SkeletonTable } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { AttackMatrixHeatmap } from '../components/AttackMatrixHeatmap'

const TACTICS = [
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

const TACTIC_COLORS = {
  'Reconnaissance': 'bg-purple-500/20 border-purple-500/50 text-purple-400',
  'Resource Development': 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400',
  'Initial Access': 'bg-blue-500/20 border-blue-500/50 text-blue-400',
  'Execution': 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400',
  'Persistence': 'bg-teal-500/20 border-teal-500/50 text-teal-400',
  'Privilege Escalation': 'bg-green-500/20 border-green-500/50 text-green-400',
  'Defense Evasion': 'bg-lime-500/20 border-lime-500/50 text-lime-400',
  'Credential Access': 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
  'Discovery': 'bg-amber-500/20 border-amber-500/50 text-amber-400',
  'Lateral Movement': 'bg-orange-500/20 border-orange-500/50 text-orange-400',
  'Collection': 'bg-red-500/20 border-red-500/50 text-red-400',
  'Command and Control': 'bg-rose-500/20 border-rose-500/50 text-rose-400',
  'Exfiltration': 'bg-pink-500/20 border-pink-500/50 text-pink-400',
  'Impact': 'bg-fuchsia-500/20 border-fuchsia-500/50 text-fuchsia-400',
}

export default function Techniques() {
  const [techniquesList, setTechniquesList] = useState([])
  const [allTechniques, setAllTechniques] = useState([]) // For heatmap
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedTactic, setSelectedTactic] = useState('')
  const [selectedTechnique, setSelectedTechnique] = useState(null)
  const [tacticCounts, setTacticCounts] = useState({})
  const [viewMode, setViewMode] = useState('table') // 'table' or 'heatmap'
  const [actorTechniques, setActorTechniques] = useState([])

  useEffect(() => {
    loadTechniques()
    loadTacticCounts()
    loadActorTechniques()
    loadAllTechniques()
  }, [search, selectedTactic])

  async function loadTechniques() {
    setLoading(true)
    try {
      const { data, error } = await techniquesApi.getAll({
        search,
        tactic: selectedTactic,
        limit: 200,
      })

      if (error) throw error
      setTechniquesList(data || [])
    } catch (error) {
      console.error('Error loading techniques:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadTacticCounts() {
    try {
      const counts = await techniquesApi.getTacticSummary()
      setTacticCounts(counts)
    } catch (error) {
      console.error('Error loading tactic counts:', error)
    }
  }

  async function loadActorTechniques() {
    try {
      const { data } = await supabase
        .from('actor_techniques')
        .select('technique_id')

      // Count occurrences of each technique
      const counts = {}
      for (const row of data || []) {
        counts[row.technique_id] = (counts[row.technique_id] || 0) + 1
      }

      setActorTechniques(
        Object.entries(counts).map(([technique_id, count]) => ({
          technique_id,
          count,
        }))
      )
    } catch (error) {
      console.error('Error loading actor techniques:', error)
    }
  }

  async function loadAllTechniques() {
    try {
      const { data } = await techniquesApi.getAll({ limit: 1000 })
      setAllTechniques(data || [])
    } catch (error) {
      console.error('Error loading all techniques:', error)
    }
  }

  // Group techniques by parent (T1234) and sub-techniques (T1234.001)
  const groupedTechniques = techniquesList.reduce((acc, tech) => {
    if (tech.is_subtechnique) {
      const parentId = tech.id.split('.')[0]
      if (!acc[parentId]) {
        acc[parentId] = { parent: null, subs: [] }
      }
      acc[parentId].subs.push(tech)
    } else {
      if (!acc[tech.id]) {
        acc[tech.id] = { parent: null, subs: [] }
      }
      acc[tech.id].parent = tech
    }
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">MITRE ATT&CK Techniques</h1>
        <p className="text-gray-400 text-sm mt-1">
          Enterprise attack techniques and tactics reference
        </p>
      </div>

      {/* Tactic filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedTactic('')}
          className={`px-3 py-1.5 rounded text-sm transition-colors ${
            selectedTactic === ''
              ? 'bg-cyber-accent/20 text-cyber-accent border border-cyber-accent/50'
              : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-600'
          }`}
        >
          All Tactics ({Object.values(tacticCounts).reduce((a, b) => a + b, 0)})
        </button>
        {TACTICS.map((tactic) => (
          <button
            key={tactic}
            onClick={() => setSelectedTactic(selectedTactic === tactic ? '' : tactic)}
            className={`px-3 py-1.5 rounded text-sm transition-colors border ${
              selectedTactic === tactic
                ? TACTIC_COLORS[tactic] || 'bg-cyber-accent/20 text-cyber-accent border-cyber-accent/50'
                : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
            }`}
          >
            {tactic} ({tacticCounts[tactic] || 0})
          </button>
        ))}
      </div>

      {/* Search and View Toggle */}
      <div className="flex gap-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search techniques by ID or name..."
          className="cyber-input flex-1"
        />
        <div className="flex rounded overflow-hidden border border-gray-700">
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-2 text-sm ${
              viewMode === 'table'
                ? 'bg-cyber-accent/20 text-cyber-accent'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('heatmap')}
            className={`px-3 py-2 text-sm ${
              viewMode === 'heatmap'
                ? 'bg-cyber-accent/20 text-cyber-accent'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Heatmap View */}
      {viewMode === 'heatmap' && (
        <div className="cyber-card p-6">
          <h3 className="text-sm text-gray-400 mb-4">
            ATT&CK Matrix Heatmap
            <span className="text-xs text-gray-500 ml-2">
              (color intensity = number of threat actors using technique)
            </span>
          </h3>
          <AttackMatrixHeatmap
            techniques={allTechniques}
            actorTechniques={actorTechniques}
            onTechniqueClick={setSelectedTechnique}
          />
        </div>
      )}

      {/* Content - Table View */}
      {viewMode === 'table' && (
      <div className="flex gap-6">
        {/* Technique List */}
        <div className="flex-1">
          {loading ? (
            <SkeletonTable rows={10} cols={4} />
          ) : techniquesList.length === 0 ? (
            <EmptyState
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              }
              title="No techniques found"
              description="Run the MITRE ATT&CK ingestion script to populate techniques, or adjust your search criteria."
            />
          ) : (
            <div className="cyber-card overflow-hidden">
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Tactics</th>
                    <th className="hidden lg:table-cell">Platforms</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(groupedTechniques)
                    .filter(g => g.parent)
                    .sort((a, b) => a.parent.id.localeCompare(b.parent.id))
                    .map(({ parent, subs }) => (
                      <>
                        {/* Parent technique */}
                        <tr
                          key={parent.id}
                          onClick={() => setSelectedTechnique(parent)}
                          className="cursor-pointer"
                        >
                          <td>
                            <span className="font-mono text-cyber-accent">{parent.id}</span>
                          </td>
                          <td>
                            <div className="font-medium text-white">{parent.name}</div>
                            {subs.length > 0 && (
                              <div className="text-xs text-gray-500">
                                {subs.length} sub-technique{subs.length !== 1 ? 's' : ''}
                              </div>
                            )}
                          </td>
                          <td>
                            <div className="flex flex-wrap gap-1">
                              {parent.tactics?.slice(0, 2).map((tactic) => (
                                <span
                                  key={tactic}
                                  className={`text-xs px-1.5 py-0.5 rounded border ${TACTIC_COLORS[tactic] || 'bg-gray-800 border-gray-700 text-gray-400'}`}
                                >
                                  {tactic.split(' ')[0]}
                                </span>
                              ))}
                              {parent.tactics?.length > 2 && (
                                <span className="text-xs text-gray-500">
                                  +{parent.tactics.length - 2}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="hidden lg:table-cell text-xs text-gray-400">
                            {parent.platforms?.slice(0, 3).join(', ')}
                            {parent.platforms?.length > 3 && '...'}
                          </td>
                        </tr>
                        {/* Sub-techniques (shown when parent is selected or search active) */}
                        {(selectedTechnique?.id === parent.id || search) &&
                          subs.map((sub) => (
                            <tr
                              key={sub.id}
                              onClick={() => setSelectedTechnique(sub)}
                              className="cursor-pointer bg-gray-900/30"
                            >
                              <td className="pl-8">
                                <span className="font-mono text-gray-400">{sub.id}</span>
                              </td>
                              <td>
                                <div className="text-gray-300">{sub.name}</div>
                              </td>
                              <td colSpan={2}></td>
                            </tr>
                          ))}
                      </>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Technique Detail Panel */}
        {selectedTechnique && (
          <div className="w-96 cyber-card hidden lg:block max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-mono text-cyber-accent">{selectedTechnique.id}</h3>
              <button
                onClick={() => setSelectedTechnique(null)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <div className="text-lg font-medium text-white mb-2">
                  {selectedTechnique.name}
                </div>
                {selectedTechnique.is_subtechnique && (
                  <span className="badge-info">Sub-technique</span>
                )}
              </div>

              {selectedTechnique.description && (
                <div>
                  <div className="text-gray-500 mb-1">Description</div>
                  <div className="text-gray-300 text-xs whitespace-pre-wrap">
                    {selectedTechnique.description.slice(0, 500)}
                    {selectedTechnique.description.length > 500 && '...'}
                  </div>
                </div>
              )}

              {selectedTechnique.tactics?.length > 0 && (
                <div>
                  <div className="text-gray-500 mb-1">Tactics</div>
                  <div className="flex flex-wrap gap-1">
                    {selectedTechnique.tactics.map((tactic) => (
                      <span
                        key={tactic}
                        className={`text-xs px-2 py-0.5 rounded border ${TACTIC_COLORS[tactic] || 'bg-gray-800 border-gray-700 text-gray-400'}`}
                      >
                        {tactic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedTechnique.platforms?.length > 0 && (
                <div>
                  <div className="text-gray-500 mb-1">Platforms</div>
                  <div className="text-gray-300">
                    {selectedTechnique.platforms.join(', ')}
                  </div>
                </div>
              )}

              {selectedTechnique.data_sources?.length > 0 && (
                <div>
                  <div className="text-gray-500 mb-1">Data Sources</div>
                  <div className="text-gray-300 text-xs">
                    {selectedTechnique.data_sources.join(', ')}
                  </div>
                </div>
              )}

              {selectedTechnique.mitigations?.length > 0 && (
                <div>
                  <div className="text-gray-500 mb-1">Mitigations</div>
                  <ul className="text-gray-300 text-xs space-y-1">
                    {selectedTechnique.mitigations.map((mit, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <span className="text-green-500">•</span>
                        {mit}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedTechnique.detection && (
                <div>
                  <div className="text-gray-500 mb-1">Detection</div>
                  <div className="text-gray-300 text-xs whitespace-pre-wrap">
                    {selectedTechnique.detection.slice(0, 300)}
                    {selectedTechnique.detection.length > 300 && '...'}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-gray-800">
                <a
                  href={selectedTechnique.url || `https://attack.mitre.org/techniques/${selectedTechnique.id.replace('.', '/')}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyber-accent text-xs hover:underline"
                >
                  View on MITRE ATT&CK →
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
