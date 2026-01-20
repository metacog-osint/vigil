// Threat Level Gauge component
import { useMemo } from 'react'
import { clsx } from 'clsx'

const THREAT_LEVELS = [
  { label: 'Low', min: 0, max: 25, color: 'text-green-400', bg: 'bg-green-400' },
  { label: 'Moderate', min: 25, max: 50, color: 'text-yellow-400', bg: 'bg-yellow-400' },
  { label: 'High', min: 50, max: 75, color: 'text-orange-400', bg: 'bg-orange-400' },
  { label: 'Critical', min: 75, max: 100, color: 'text-red-400', bg: 'bg-red-400' },
]

export function calculateThreatScore({
  newKEVs = 0,
  incidentVelocity = 0,
  iocVolume = 0,
  criticalCVEs = 0,
  escalatingActors = 0,
}) {
  // Weighted scoring algorithm
  let score = 0

  // New KEVs this week (high impact) - max 30 points
  score += Math.min(newKEVs * 3, 30)

  // Incident velocity (incidents per day) - max 25 points
  score += Math.min(incidentVelocity * 5, 25)

  // IOC volume change - max 15 points
  score += Math.min(iocVolume * 0.1, 15)

  // Critical CVEs (CVSS 9+) - max 15 points
  score += Math.min(criticalCVEs * 1.5, 15)

  // Escalating actors - max 15 points
  score += Math.min(escalatingActors * 3, 15)

  return Math.min(Math.round(score), 100)
}

export function ThreatGauge({
  score = 0,
  trend = 'stable', // 'up', 'down', 'stable'
  factors = [],
  className = '',
}) {
  const level = useMemo(() => {
    return (
      THREAT_LEVELS.find((l) => score >= l.min && score < l.max) ||
      THREAT_LEVELS[THREAT_LEVELS.length - 1]
    )
  }, [score])

  const trendIcon = {
    up: '↑',
    down: '↓',
    stable: '→',
  }

  const trendColor = {
    up: 'text-red-400',
    down: 'text-green-400',
    stable: 'text-gray-400',
  }

  return (
    <div className={clsx('cyber-card', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-400">Threat Level</h3>
        <div className={clsx('flex items-center gap-1', trendColor[trend])}>
          <span className="text-lg">{trendIcon[trend]}</span>
          <span className="text-xs">
            {trend === 'up' ? 'Rising' : trend === 'down' ? 'Declining' : 'Stable'}
          </span>
        </div>
      </div>

      {/* Main gauge */}
      <div className="relative mb-4">
        {/* Score display */}
        <div className="text-center mb-2">
          <span className={clsx('text-4xl font-bold', level.color)}>{score}</span>
          <span className="text-gray-500 text-lg">/100</span>
        </div>

        {/* Level label */}
        <div className={clsx('text-center text-sm font-medium', level.color)}>{level.label}</div>

        {/* Gauge bar */}
        <div className="mt-4 h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={clsx('h-full rounded-full transition-all duration-500', level.bg)}
            style={{ width: `${score}%` }}
          />
        </div>

        {/* Scale markers */}
        <div className="flex justify-between mt-1 text-xs text-gray-600">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100</span>
        </div>
      </div>

      {/* Contributing factors */}
      {factors.length > 0 && (
        <div className="pt-3 border-t border-gray-800">
          <div className="text-xs text-gray-500 mb-2">Contributing Factors</div>
          <div className="space-y-1">
            {factors.map((factor, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-400">{factor.label}</span>
                <span className={factor.isHigh ? 'text-red-400' : 'text-gray-500'}>
                  {factor.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function ThreatGaugeMini({ score = 0, className = '' }) {
  const level =
    THREAT_LEVELS.find((l) => score >= l.min && score < l.max) ||
    THREAT_LEVELS[THREAT_LEVELS.length - 1]

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <div className={clsx('text-xl font-bold', level.color)}>{score}</div>
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full', level.bg)} style={{ width: `${score}%` }} />
      </div>
      <div className={clsx('text-xs font-medium', level.color)}>{level.label}</div>
    </div>
  )
}

export default ThreatGauge
