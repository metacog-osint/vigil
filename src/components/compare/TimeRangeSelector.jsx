/**
 * TimeRangeSelector Component
 *
 * Allows users to select comparison time periods.
 */
import { useState } from 'react'

const PRESET_RANGES = [
  { id: 'week', label: 'This Week vs Last Week', current: 7, previous: 7 },
  { id: 'month', label: 'This Month vs Last Month', current: 30, previous: 30 },
  { id: '2weeks', label: 'Last 2 Weeks vs Prior 2 Weeks', current: 14, previous: 14 },
  { id: 'quarter', label: 'This Quarter vs Last Quarter', current: 90, previous: 90 },
]

export function TimeRangeSelector({ value, onChange, className = '' }) {
  const [showCustom, setShowCustom] = useState(false)
  const [customDays, setCustomDays] = useState(7)

  const handlePresetSelect = (preset) => {
    onChange({
      type: 'preset',
      id: preset.id,
      currentDays: preset.current,
      previousDays: preset.previous,
      label: preset.label,
    })
    setShowCustom(false)
  }

  const handleCustomApply = () => {
    onChange({
      type: 'custom',
      id: 'custom',
      currentDays: customDays,
      previousDays: customDays,
      label: `Last ${customDays} days vs Prior ${customDays} days`,
    })
    setShowCustom(false)
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Preset buttons */}
      <div className="flex items-center gap-1 bg-gray-800/50 rounded-lg p-1">
        {PRESET_RANGES.map((preset) => (
          <button
            key={preset.id}
            onClick={() => handlePresetSelect(preset)}
            className={`
              px-3 py-1.5 text-sm rounded-md transition-colors
              ${
                value?.id === preset.id
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }
            `}
          >
            {preset.id === 'week'
              ? 'Week'
              : preset.id === 'month'
                ? 'Month'
                : preset.id === '2weeks'
                  ? '2 Weeks'
                  : 'Quarter'}
          </button>
        ))}

        <button
          onClick={() => setShowCustom(!showCustom)}
          className={`
            px-3 py-1.5 text-sm rounded-md transition-colors
            ${
              value?.type === 'custom'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }
          `}
        >
          Custom
        </button>
      </div>

      {/* Custom range popup */}
      {showCustom && (
        <div className="absolute top-full mt-2 right-0 bg-cyber-dark border border-gray-700 rounded-lg p-4 shadow-xl z-50">
          <div className="text-sm text-gray-400 mb-2">Compare last N days</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="365"
              value={customDays}
              onChange={(e) => setCustomDays(parseInt(e.target.value) || 7)}
              className="w-20 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
            />
            <span className="text-gray-400 text-sm">days</span>
            <button
              onClick={handleCustomApply}
              className="px-3 py-1 bg-cyan-500 text-white text-sm rounded hover:bg-cyan-600"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Current selection label */}
      {value && <span className="text-sm text-gray-500 ml-2">{value.label}</span>}
    </div>
  )
}

export default TimeRangeSelector
