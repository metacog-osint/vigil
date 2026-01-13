// Tag Selector - Add/remove tags on entities
import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { tags as tagsApi } from '../lib/supabase'

export function TagSelector({
  entityType,
  entityId,
  className = '',
}) {
  const [allTags, setAllTags] = useState([])
  const [entityTags, setEntityTags] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    loadTags()
  }, [entityId, entityType])

  const loadTags = async () => {
    const [allResult, entityResult] = await Promise.all([
      tagsApi.getAll(),
      tagsApi.getForEntity(entityType, entityId),
    ])
    setAllTags(allResult.data || [])
    setEntityTags((entityResult.data || []).map((et) => et.tag))
  }

  const toggleTag = async (tag) => {
    setIsLoading(true)
    try {
      const isTagged = entityTags.some((t) => t.id === tag.id)
      if (isTagged) {
        await tagsApi.removeFromEntity(tag.id, entityType, entityId)
        setEntityTags(entityTags.filter((t) => t.id !== tag.id))
      } else {
        await tagsApi.addToEntity(tag.id, entityType, entityId)
        setEntityTags([...entityTags, tag])
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={clsx('', className)}>
      {/* Current tags */}
      <div className="flex flex-wrap gap-1 items-center">
        {entityTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
            style={{ backgroundColor: tag.color + '30', color: tag.color }}
          >
            {tag.name}
            <button
              onClick={() => toggleTag(tag)}
              className="hover:text-white transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-gray-500 hover:text-gray-300 transition-colors p-1"
          title="Add tag"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute mt-1 z-50 bg-cyber-dark border border-gray-700 rounded-lg shadow-lg py-1 min-w-[180px]">
            {allTags.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                No tags created yet
              </div>
            ) : (
              allTags.map((tag) => {
                const isTagged = entityTags.some((t) => t.id === tag.id)
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag)}
                    disabled={isLoading}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-gray-300 flex-1">{tag.name}</span>
                    {isTagged && (
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}

// Display-only tags (for lists)
export function TagBadges({ tags = [], className = '' }) {
  if (tags.length === 0) return null

  return (
    <div className={clsx('flex flex-wrap gap-1', className)}>
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="px-2 py-0.5 rounded-full text-xs"
          style={{ backgroundColor: tag.color + '30', color: tag.color }}
        >
          {tag.name}
        </span>
      ))}
    </div>
  )
}

export default TagSelector
