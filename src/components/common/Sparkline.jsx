// Sparkline - tiny line chart for inline trend visualization
import { useMemo } from 'react'
import { clsx } from 'clsx'

export function Sparkline({
  data = [],
  width = 80,
  height = 24,
  strokeWidth = 1.5,
  className = '',
  showTrend = true,
}) {
  const { points, trend, min, max, change } = useMemo(() => {
    if (!data || data.length === 0) {
      return { points: '', trend: 'neutral', min: 0, max: 0, change: 0 }
    }

    const values = data.map(d => (typeof d === 'number' ? d : d.value))
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1

    // Generate SVG path
    const stepX = width / (values.length - 1 || 1)
    const points = values
      .map((v, i) => {
        const x = i * stepX
        const y = height - ((v - min) / range) * height
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')

    // Calculate trend
    const first = values[0]
    const last = values[values.length - 1]
    const change = ((last - first) / (first || 1)) * 100
    const trend = change > 5 ? 'up' : change < -5 ? 'down' : 'neutral'

    return { points, trend, min, max, change }
  }, [data, width, height])

  const strokeColor = {
    up: '#ef4444',    // red
    down: '#22c55e',  // green
    neutral: '#6b7280', // gray
  }

  if (!data || data.length === 0) {
    return (
      <div
        className={clsx('flex items-center justify-center text-gray-600', className)}
        style={{ width, height }}
      >
        <span className="text-xs">No data</span>
      </div>
    )
  }

  return (
    <div className={clsx('inline-flex items-center gap-1', className)}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        <path
          d={points}
          fill="none"
          stroke={strokeColor[trend]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* End dot */}
        <circle
          cx={width}
          cy={height - ((data[data.length - 1] - min) / (max - min || 1)) * height}
          r={2}
          fill={strokeColor[trend]}
        />
      </svg>
      {showTrend && (
        <span className={clsx('text-xs font-medium', {
          'text-red-400': trend === 'up',
          'text-green-400': trend === 'down',
          'text-gray-500': trend === 'neutral',
        })}>
          {change > 0 ? '+' : ''}{change.toFixed(0)}%
        </span>
      )}
    </div>
  )
}

export function SparklineBar({
  data = [],
  width = 80,
  height = 24,
  barWidth = 4,
  gap = 2,
  className = '',
}) {
  const { bars, max } = useMemo(() => {
    if (!data || data.length === 0) {
      return { bars: [], max: 0 }
    }

    const values = data.map(d => (typeof d === 'number' ? d : d.value))
    const max = Math.max(...values, 1)

    const bars = values.map((v, i) => ({
      value: v,
      height: (v / max) * height,
    }))

    return { bars, max }
  }, [data, height])

  if (!data || data.length === 0) {
    return null
  }

  const totalWidth = bars.length * (barWidth + gap) - gap

  return (
    <div className={className}>
      <svg
        width={totalWidth}
        height={height}
        viewBox={`0 0 ${totalWidth} ${height}`}
      >
        {bars.map((bar, i) => (
          <rect
            key={i}
            x={i * (barWidth + gap)}
            y={height - bar.height}
            width={barWidth}
            height={bar.height}
            rx={1}
            className={clsx(
              i === bars.length - 1 ? 'fill-cyber-accent' : 'fill-gray-700'
            )}
          />
        ))}
      </svg>
    </div>
  )
}

export default Sparkline
