/**
 * Missed Alerts Widget
 *
 * Shows free/lower-tier users what alerts they would have received
 * if they had a premium subscription.
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { useSubscription } from '../../contexts/SubscriptionContext'
import { supabase } from '../../lib/supabase/client'

const ALERT_TYPE_CONFIG = {
  ransomware: {
    icon: '🔴',
    label: 'Ransomware Attack',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
  },
  kev: {
    icon: '🟠',
    label: 'New KEV Added',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
  },
  actor_escalating: {
    icon: '📈',
    label: 'Actor Escalating',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
  },
  ioc_match: {
    icon: '🎯',
    label: 'IOC Match',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
  },
  sector_spike: {
    icon: '🏥',
    label: 'Sector Activity',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  vendor_cve: {
    icon: '⚠️',
    label: 'Vendor CVE',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
  },
}

/**
 * Fetch alerts that the user would have received with premium
 */
async function fetchMissedAlerts(orgProfile, days = 7) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const alerts = []

  // Get recent ransomware incidents targeting user's sector
  if (orgProfile?.sector) {
    const { data: incidents } = await supabase
      .from('incidents')
      .select('id, victim_name, threat_actor:threat_actors(name), discovered_at')
      .ilike('sector', `%${orgProfile.sector}%`)
      .gte('discovered_at', cutoff.toISOString())
      .order('discovered_at', { ascending: false })
      .limit(3)

    incidents?.forEach(inc => {
      alerts.push({
        type: 'ransomware',
        title: `${inc.threat_actor?.name || 'Unknown'} hit ${orgProfile.sector} sector`,
        description: inc.victim_name,
        date: inc.discovered_at,
        relevance: 'high',
      })
    })
  }

  // Get recent KEVs affecting user's vendors
  if (orgProfile?.tech_vendors?.length > 0) {
    const vendorPattern = orgProfile.tech_vendors.slice(0, 5).join('|')
    const { data: kevs } = await supabase
      .from('vulnerabilities')
      .select('cve_id, description, published_date')
      .eq('in_kev', true)
      .gte('published_date', cutoff.toISOString())
      .or(`description.ilike.%${vendorPattern}%,affected_products.cs.{${orgProfile.tech_vendors.join(',')}}`)
      .limit(3)

    kevs?.forEach(kev => {
      alerts.push({
        type: 'kev',
        title: `Critical CVE affecting your stack`,
        description: kev.cve_id,
        date: kev.published_date,
        relevance: 'critical',
      })
    })
  }

  // Get escalating actors targeting user's sector
  if (orgProfile?.sector) {
    const { data: actors } = await supabase
      .from('threat_actors')
      .select('name, trend_status, target_sectors')
      .eq('trend_status', 'ESCALATING')
      .contains('target_sectors', [orgProfile.sector])
      .limit(2)

    actors?.forEach(actor => {
      alerts.push({
        type: 'actor_escalating',
        title: `${actor.name} is escalating`,
        description: `Targeting ${orgProfile.sector}`,
        date: new Date().toISOString(),
        relevance: 'high',
      })
    })
  }

  return alerts.slice(0, 8) // Limit total
}

/**
 * Generate sample missed alerts for users without org profile
 */
function generateSampleAlerts() {
  return [
    {
      type: 'ransomware',
      title: 'LockBit hit healthcare sector',
      description: '3 incidents this week',
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      relevance: 'sample',
    },
    {
      type: 'kev',
      title: 'Critical Microsoft Exchange CVE',
      description: 'CVE-2026-1234 added to KEV',
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      relevance: 'sample',
    },
    {
      type: 'actor_escalating',
      title: 'BlackCat activity increasing',
      description: '+150% incidents this week',
      date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      relevance: 'sample',
    },
  ]
}

function AlertItem({ alert }) {
  const config = ALERT_TYPE_CONFIG[alert.type] || ALERT_TYPE_CONFIG.ransomware
  const date = new Date(alert.date)
  const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))

  return (
    <div className={clsx(
      'flex items-start gap-3 p-3 rounded-lg border',
      config.bg,
      config.border
    )}>
      <span className="text-xl">{config.icon}</span>
      <div className="flex-1 min-w-0">
        <div className={clsx('text-sm font-medium', config.color)}>
          {alert.title}
        </div>
        <div className="text-xs text-gray-500 truncate">
          {alert.description}
        </div>
      </div>
      <div className="text-xs text-gray-500 whitespace-nowrap">
        {daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`}
      </div>
    </div>
  )
}

/**
 * Full missed alerts widget for dashboard
 */
export function MissedAlertsWidget({ orgProfile, className }) {
  const { tier, canAccess } = useSubscription()
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  const hasAlerts = canAccess('email_digests')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        if (orgProfile?.sector) {
          const missed = await fetchMissedAlerts(orgProfile, 7)
          setAlerts(missed)
        } else {
          setAlerts(generateSampleAlerts())
        }
      } catch (err) {
        console.error('Failed to fetch missed alerts:', err)
        setAlerts(generateSampleAlerts())
      }
      setLoading(false)
    }
    load()
  }, [orgProfile])

  // Don't show if user already has alerts
  if (hasAlerts) return null

  return (
    <div className={clsx('cyber-card', className)}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-medium">Alerts You Would Have Received</h3>
          <p className="text-xs text-gray-500">This week with Professional</p>
        </div>
        <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded">
          {alerts.length} alerts
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-800/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.slice(0, 5).map((alert, i) => (
            <AlertItem key={i} alert={alert} />
          ))}
          {alerts.length > 5 && (
            <div className="text-center text-xs text-gray-500 py-2">
              +{alerts.length - 5} more alerts
            </div>
          )}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-800">
        <Link
          to="/pricing"
          className="block w-full text-center px-4 py-2 bg-cyber-accent text-black font-medium rounded-lg hover:bg-cyber-accent/90"
        >
          Get Real-Time Alerts
        </Link>
        <p className="text-xs text-gray-500 text-center mt-2">
          Professional includes email digests + custom alert rules
        </p>
      </div>
    </div>
  )
}

/**
 * Compact card version for sidebars
 */
export function MissedAlertsCard({ count = 7, className }) {
  const { canAccess } = useSubscription()

  if (canAccess('email_digests')) return null

  return (
    <Link
      to="/pricing"
      className={clsx(
        'block p-4 rounded-lg border transition-all',
        'bg-gradient-to-r from-yellow-500/10 to-orange-500/10',
        'border-yellow-500/20 hover:border-yellow-500/40',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="text-3xl">🔔</div>
        <div>
          <div className="text-white font-medium">
            {count} alerts this week
          </div>
          <div className="text-xs text-yellow-400/70">
            You're not receiving alerts
          </div>
        </div>
      </div>
      <div className="mt-3 text-xs text-gray-400">
        Upgrade to Professional →
      </div>
    </Link>
  )
}

/**
 * Summary stats for email template
 */
export function MissedAlertsSummary({ alerts }) {
  const byType = alerts.reduce((acc, alert) => {
    acc[alert.type] = (acc[alert.type] || 0) + 1
    return acc
  }, {})

  return (
    <div className="grid grid-cols-3 gap-4 text-center">
      {Object.entries(byType).slice(0, 3).map(([type, count]) => {
        const config = ALERT_TYPE_CONFIG[type] || ALERT_TYPE_CONFIG.ransomware
        return (
          <div key={type} className={clsx('p-3 rounded-lg', config.bg)}>
            <div className="text-2xl mb-1">{config.icon}</div>
            <div className={clsx('text-2xl font-bold', config.color)}>{count}</div>
            <div className="text-xs text-gray-500">{config.label}</div>
          </div>
        )
      })}
    </div>
  )
}

export default MissedAlertsWidget
