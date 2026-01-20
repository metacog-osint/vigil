/**
 * IOC Table View Component
 */
import { IOC_TYPES } from '../../lib/customIocs'
import SeverityBadge from '../../components/SeverityBadge'
import { SmartTime } from '../../components/TimeDisplay'

export default function IocTableView({
  iocs,
  selectedIocs,
  setSelectedIocs,
  onShowAddModal,
  onShowImportModal,
}) {
  if (iocs.length === 0) {
    return (
      <div className="cyber-card p-8 text-center">
        <svg
          className="w-12 h-12 text-gray-600 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <p className="text-gray-400 mb-4">No IOCs in this list</p>
        <div className="flex justify-center gap-2">
          <button onClick={onShowAddModal} className="cyber-button text-sm">
            Add Manually
          </button>
          <button onClick={onShowImportModal} className="cyber-button-primary text-sm">
            Import from File
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="cyber-card overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-900/50">
          <tr>
            <th className="px-4 py-3 text-left">
              <input
                type="checkbox"
                checked={selectedIocs.length === iocs.length && iocs.length > 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedIocs(iocs.map((i) => i.id))
                  } else {
                    setSelectedIocs([])
                  }
                }}
                className="rounded border-gray-600"
              />
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
              Value
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
              Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
              Threat
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
              Severity
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
              Confidence
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
              Added
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {iocs.map((ioc) => (
            <tr key={ioc.id} className="hover:bg-gray-800/50">
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedIocs.includes(ioc.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIocs((prev) => [...prev, ioc.id])
                    } else {
                      setSelectedIocs((prev) => prev.filter((id) => id !== ioc.id))
                    }
                  }}
                  className="rounded border-gray-600"
                />
              </td>
              <td className="px-4 py-3">
                <div className="font-mono text-sm text-white truncate max-w-xs" title={ioc.value}>
                  {ioc.value}
                </div>
                {ioc.public_match_id && (
                  <span className="text-xs text-green-400">Matched in public feeds</span>
                )}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`px-2 py-1 rounded text-xs bg-${IOC_TYPES[ioc.ioc_type]?.color || 'gray'}-500/20 text-${IOC_TYPES[ioc.ioc_type]?.color || 'gray'}-400`}
                >
                  {IOC_TYPES[ioc.ioc_type]?.label || ioc.ioc_type}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-400 text-sm">{ioc.threat_type || '-'}</td>
              <td className="px-4 py-3">
                <SeverityBadge severity={ioc.severity} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-12 bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        ioc.confidence >= 80
                          ? 'bg-green-500'
                          : ioc.confidence >= 50
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      }`}
                      style={{ width: `${ioc.confidence}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{ioc.confidence}%</span>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-400 text-sm">
                <SmartTime date={ioc.created_at} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
