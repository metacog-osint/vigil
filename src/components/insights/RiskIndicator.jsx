/**
 * RiskIndicator Component
 *
 * Visual gauge showing organization risk score.
 */

const RISK_COLORS = {
  low: { fill: '#10b981', bg: 'bg-green-500/20', text: 'text-green-400' },
  medium: { fill: '#eab308', bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  high: { fill: '#f97316', bg: 'bg-orange-500/20', text: 'text-orange-400' },
  critical: { fill: '#ef4444', bg: 'bg-red-500/20', text: 'text-red-400' },
}

export function RiskIndicator({
  score,
  risk,
  factors = [],
  trend,
  showDetails = true,
  size = 'normal', // 'small' | 'normal' | 'large'
}) {
  const colors = RISK_COLORS[risk] || RISK_COLORS.low

  // Size configurations
  const sizes = {
    small: { gauge: 60, stroke: 6, label: 'text-lg' },
    normal: { gauge: 100, stroke: 8, label: 'text-2xl' },
    large: { gauge: 140, stroke: 10, label: 'text-4xl' },
  }
  const config = sizes[size] || sizes.normal

  // Calculate arc
  const radius = (config.gauge - config.stroke) / 2
  const circumference = radius * Math.PI // Half circle
  const progress = (score / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      {/* Gauge */}
      <div className="relative" style={{ width: config.gauge, height: config.gauge / 2 + 20 }}>
        <svg
          width={config.gauge}
          height={config.gauge / 2 + 10}
          viewBox={`0 0 ${config.gauge} ${config.gauge / 2 + 10}`}
        >
          {/* Background arc */}
          <path
            d={`M ${config.stroke / 2} ${config.gauge / 2} A ${radius} ${radius} 0 0 1 ${config.gauge - config.stroke / 2} ${config.gauge / 2}`}
            fill="none"
            stroke="#374151"
            strokeWidth={config.stroke}
            strokeLinecap="round"
          />

          {/* Progress arc */}
          <path
            d={`M ${config.stroke / 2} ${config.gauge / 2} A ${radius} ${radius} 0 0 1 ${config.gauge - config.stroke / 2} ${config.gauge / 2}`}
            fill="none"
            stroke={colors.fill}
            strokeWidth={config.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
          />

          {/* Tick marks */}
          {[0, 25, 50, 75, 100].map((tick) => {
            const angle = (tick / 100) * Math.PI
            const x1 = config.gauge / 2 + (radius - config.stroke) * Math.cos(Math.PI - angle)
            const y1 = config.gauge / 2 - (radius - config.stroke) * Math.sin(angle)
            const x2 = config.gauge / 2 + (radius + 2) * Math.cos(Math.PI - angle)
            const y2 = config.gauge / 2 - (radius + 2) * Math.sin(angle)

            return (
              <line
                key={tick}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#6b7280"
                strokeWidth={1}
              />
            )
          })}
        </svg>

        {/* Score label */}
        <div className="absolute inset-x-0 bottom-0 text-center">
          <span className={`font-bold ${colors.text} ${config.label}`}>{score}</span>
          <span className="text-gray-500 text-xs block">/ 100</span>
        </div>
      </div>

      {/* Risk label */}
      <div className={`mt-2 px-3 py-1 rounded-full text-sm font-medium uppercase ${colors.bg} ${colors.text}`}>
        {risk} Risk
        {trend && trend !== 'stable' && (
          <span className="ml-1">
            {trend === 'increasing' ? '↑' : '↓'}
          </span>
        )}
      </div>

      {/* Factors breakdown */}
      {showDetails && factors.length > 0 && (
        <div className="mt-4 w-full space-y-2">
          {factors.map((factor, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <span className="text-gray-400">{factor.factor}</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 rounded-full"
                    style={{ width: `${(factor.score / 35) * 100}%` }}
                  />
                </div>
                <span className="text-gray-500 w-6 text-right">{factor.score}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default RiskIndicator
