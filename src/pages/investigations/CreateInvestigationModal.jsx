/**
 * Create Investigation Modal Component
 */
import { useState } from 'react'
import { CATEGORIES, PRIORITIES, TLP_OPTIONS } from '../../lib/investigations'
import { TLP_COLORS } from './InvestigationConstants.jsx'

export default function CreateInvestigationModal({ templates, onClose, onCreate }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [priority, setPriority] = useState('medium')
  const [tlp, setTlp] = useState('amber')
  const [templateId, setTemplateId] = useState('')
  const [creating, setCreating] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return

    setCreating(true)
    await onCreate({
      title: title.trim(),
      description: description.trim(),
      category,
      priority,
      tlp,
      templateId: templateId || null,
    })
    setCreating(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white">New Investigation</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              placeholder="e.g., APT29 Phishing Campaign Analysis"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              rows={2}
              placeholder="Brief description of the investigation..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              >
                <option value="">Select category</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Traffic Light Protocol
            </label>
            <div className="flex gap-2">
              {TLP_OPTIONS.map((t) => {
                const colors = TLP_COLORS[t.value]
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTlp(t.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      tlp === t.value
                        ? `${colors.bg} ${colors.text} ring-1 ring-current`
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                    title={t.description}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>

          {templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Start from template
              </label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
              >
                <option value="">Blank investigation</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white"
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !title.trim()}
              className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Investigation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
