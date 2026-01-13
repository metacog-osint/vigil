// Filter bar component with active filter display and controls
import { clsx } from 'clsx'
import { FILTER_PRESETS } from '../hooks/useFilters'

export function FilterBar({
  filters,
  setFilter,
  clearFilters,
  hasActiveFilters,
  getShareableUrl,
  filterConfig = {},
  className = '',
}) {
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(getShareableUrl())
      // Could add a toast notification here
    } catch (err) {
      console.error('Failed to copy URL:', err)
    }
  }

  return (
    <div className={clsx('flex flex-wrap items-center gap-2', className)}>
      {/* Active filters */}
      {Object.entries(filters).map(([key, value]) => {
        const config = filterConfig[key]
        if (!value || value === config?.default) return null

        const label = config?.label || key
        const displayValue = config?.options?.find(o => o.value === value)?.label || value

        return (
          <span
            key={key}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-cyber-accent/20 text-cyber-accent border border-cyber-accent/50 rounded"
          >
            <span className="text-gray-400">{label}:</span>
            <span>{String(displayValue)}</span>
            <button
              onClick={() => setFilter(key, config?.default || '')}
              className="ml-1 hover:text-white"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        )
      })}

      {/* Clear all button */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="text-xs text-gray-400 hover:text-white"
        >
          Clear all
        </button>
      )}

      {/* Share button */}
      {hasActiveFilters && (
        <button
          onClick={handleCopyUrl}
          className="text-xs text-gray-400 hover:text-cyber-accent flex items-center gap-1"
          title="Copy shareable URL"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Share
        </button>
      )}
    </div>
  )
}

export function FilterPresets({ onApply, className = '' }) {
  return (
    <div className={clsx('flex flex-wrap gap-2', className)}>
      <span className="text-xs text-gray-500 self-center">Quick filters:</span>
      {Object.entries(FILTER_PRESETS).map(([key, preset]) => (
        <button
          key={key}
          onClick={() => onApply(preset.filters)}
          className="text-xs px-2 py-1 bg-gray-800 text-gray-400 border border-gray-700 rounded hover:border-gray-600 hover:text-white transition-colors"
          title={preset.description}
        >
          {preset.name}
        </button>
      ))}
    </div>
  )
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  className = '',
}) {
  return (
    <div className={clsx('flex items-center gap-2', className)}>
      {label && <span className="text-xs text-gray-500">{label}:</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cyber-input text-sm py-1"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function FilterToggle({
  label,
  checked,
  onChange,
  className = '',
}) {
  return (
    <label className={clsx('flex items-center gap-2 cursor-pointer', className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div className="w-8 h-4 bg-gray-700 rounded-full peer peer-checked:bg-cyber-accent/50 peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-gray-300 after:rounded-full after:h-3 after:w-3 after:transition-transform relative"></div>
      <span className="text-xs text-gray-400">{label}</span>
    </label>
  )
}

export default FilterBar
