// Timeline - Chronological event visualization
import { useMemo } from 'react'
import { clsx } from 'clsx'
import { format, formatDistanceToNow, isToday, isYesterday, differenceInDays } from 'date-fns'

const EVENT_TYPES = {
  incident: { color: 'bg-red-500', icon: '!' },
  actor: { color: 'bg-purple-500', icon: 'A' },
  vulnerability: { color: 'bg-orange-500', icon: 'V' },
  ioc: { color: 'bg-blue-500', icon: 'I' },
  alert: { color: 'bg-yellow-500', icon: 'B' },
}

function formatEventDate(date) {
  const d = new Date(date)
  if (isToday(d)) return `Today at ${format(d, 'HH:mm')}`
  if (isYesterday(d)) return `Yesterday at ${format(d, 'HH:mm')}`
  if (differenceInDays(new Date(), d) < 7) return format(d, 'EEEE, HH:mm')
  return format(d, 'MMM d, yyyy HH:mm')
}

function TimelineItem({ event, isFirst, isLast, onClick }) {
  const typeConfig = EVENT_TYPES[event.type] || { color: 'bg-gray-500', icon: '?' }

  return (
    <div className="flex gap-4">
      {/* Timeline line and dot */}
      <div className="flex flex-col items-center">
        <div
          className={clsx(
            'w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold',
            typeConfig.color
          )}
        >
          {typeConfig.icon}
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-gray-700 min-h-[40px]" />}
      </div>

      {/* Content */}
      <div className={clsx('flex-1 pb-6', !isLast && 'border-b border-gray-800')}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <button
              onClick={() => onClick?.(event)}
              className="text-white font-medium hover:text-cyber-accent transition-colors text-left"
            >
              {event.title}
            </button>
            {event.description && (
              <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                {event.description}
              </p>
            )}
            {event.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {event.tags.slice(0, 4).map((tag, i) => (
                  <span key={i} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="text-xs text-gray-500 whitespace-nowrap">
            {formatEventDate(event.date)}
          </div>
        </div>
      </div>
    </div>
  )
}

export function Timeline({
  events = [],
  onEventClick,
  className = '',
  maxItems = 50,
}) {
  const sortedEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, maxItems)
  }, [events, maxItems])

  if (sortedEvents.length === 0) {
    return (
      <div className={clsx('text-center text-gray-500 py-8', className)}>
        No events to display
      </div>
    )
  }

  return (
    <div className={clsx('', className)}>
      {sortedEvents.map((event, i) => (
        <TimelineItem
          key={event.id || i}
          event={event}
          isFirst={i === 0}
          isLast={i === sortedEvents.length - 1}
          onClick={onEventClick}
        />
      ))}
    </div>
  )
}

// Compact timeline for dashboards
export function TimelineMini({
  events = [],
  onEventClick,
  className = '',
  maxItems = 5,
}) {
  const recentEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, maxItems)
  }, [events, maxItems])

  return (
    <div className={clsx('space-y-2', className)}>
      {recentEvents.map((event, i) => {
        const typeConfig = EVENT_TYPES[event.type] || { color: 'bg-gray-500' }
        return (
          <button
            key={event.id || i}
            onClick={() => onEventClick?.(event)}
            className="w-full flex items-center gap-3 p-2 rounded hover:bg-gray-800/50 transition-colors text-left"
          >
            <div className={clsx('w-2 h-2 rounded-full', typeConfig.color)} />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white truncate">{event.title}</div>
              <div className="text-xs text-gray-500">
                {formatDistanceToNow(new Date(event.date), { addSuffix: true })}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// Actor/campaign timeline
export function ActorTimeline({
  actorName,
  incidents = [],
  techniques = [],
  iocs = [],
  className = '',
}) {
  // Combine all events related to the actor
  const events = useMemo(() => {
    const allEvents = []

    // Add incidents
    for (const incident of incidents) {
      allEvents.push({
        id: `incident-${incident.id}`,
        type: 'incident',
        title: incident.victim_name || 'Incident',
        description: `${incident.victim_sector || 'Unknown sector'} - ${incident.victim_country || 'Unknown country'}`,
        date: incident.discovered_date,
        data: incident,
      })
    }

    // Add first IOC sightings
    const iocByDate = new Map()
    for (const ioc of iocs) {
      const dateKey = ioc.first_seen?.split('T')[0]
      if (dateKey && !iocByDate.has(dateKey)) {
        iocByDate.set(dateKey, [])
      }
      if (dateKey) {
        iocByDate.get(dateKey).push(ioc)
      }
    }

    for (const [date, dailyIocs] of iocByDate) {
      if (dailyIocs.length > 0) {
        allEvents.push({
          id: `ioc-${date}`,
          type: 'ioc',
          title: `${dailyIocs.length} new IOC${dailyIocs.length > 1 ? 's' : ''} detected`,
          description: dailyIocs.slice(0, 3).map(i => i.type).join(', '),
          date: date,
          tags: [...new Set(dailyIocs.flatMap(i => i.tags || []))].slice(0, 4),
          data: dailyIocs,
        })
      }
    }

    return allEvents
  }, [incidents, iocs])

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-white">
          Activity Timeline
          {actorName && <span className="text-gray-400 font-normal ml-2">- {actorName}</span>}
        </h3>
        <span className="text-sm text-gray-500">{events.length} events</span>
      </div>

      {events.length > 0 ? (
        <Timeline events={events} maxItems={20} />
      ) : (
        <div className="text-center text-gray-500 py-8">
          No activity recorded for this actor
        </div>
      )}
    </div>
  )
}

export default Timeline
