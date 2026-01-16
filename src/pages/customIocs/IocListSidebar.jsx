/**
 * IOC List Sidebar Component
 */

export default function IocListSidebar({ lists, selectedList, onSelectList, onShowCreateModal }) {
  return (
    <div className="w-64 flex-shrink-0 space-y-2">
      <div className="text-sm text-gray-400 uppercase tracking-wider mb-2">Your Lists</div>
      {lists.length === 0 ? (
        <div className="text-sm text-gray-500 py-4">
          No lists yet. Create one to get started.
        </div>
      ) : (
        lists.map(list => (
          <button
            key={list.id}
            onClick={() => onSelectList(list)}
            className={`w-full text-left p-3 rounded-lg border transition-colors ${
              selectedList?.id === list.id
                ? 'border-cyber-accent bg-cyber-accent/10'
                : 'border-gray-800 hover:border-gray-700 bg-gray-900/50'
            }`}
          >
            <div className="flex items-center gap-2">
              {list.color && (
                <span className={`w-3 h-3 rounded-full bg-${list.color}-500`}></span>
              )}
              <span className="font-medium text-white truncate">{list.name}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {list.ioc_count || 0} IOCs
            </div>
          </button>
        ))
      )}
    </div>
  )
}
