import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SeverityBadge, SeverityDot, SeverityBar, EPSSBadge, classifyBySeverity } from '../SeverityBadge'

describe('classifyBySeverity', () => {
  it('returns critical for scores >= 9.0', () => {
    expect(classifyBySeverity(9.0)).toBe('critical')
    expect(classifyBySeverity(10.0)).toBe('critical')
    expect(classifyBySeverity(9.5)).toBe('critical')
  })

  it('returns high for scores >= 7.0 and < 9.0', () => {
    expect(classifyBySeverity(7.0)).toBe('high')
    expect(classifyBySeverity(8.9)).toBe('high')
    expect(classifyBySeverity(8.0)).toBe('high')
  })

  it('returns medium for scores >= 4.0 and < 7.0', () => {
    expect(classifyBySeverity(4.0)).toBe('medium')
    expect(classifyBySeverity(6.9)).toBe('medium')
    expect(classifyBySeverity(5.5)).toBe('medium')
  })

  it('returns low for scores < 4.0', () => {
    expect(classifyBySeverity(0)).toBe('low')
    expect(classifyBySeverity(3.9)).toBe('low')
    expect(classifyBySeverity(2.0)).toBe('low')
  })

  it('returns info for null or undefined', () => {
    expect(classifyBySeverity(null)).toBe('info')
    expect(classifyBySeverity(undefined)).toBe('info')
  })
})

describe('SeverityBadge', () => {
  describe('score display', () => {
    it('shows score by default', () => {
      render(<SeverityBadge score={9.5} />)

      expect(screen.getByText('9.5')).toBeInTheDocument()
    })

    it('hides score when showScore is false', () => {
      render(<SeverityBadge score={9.5} showScore={false} />)

      expect(screen.queryByText('9.5')).not.toBeInTheDocument()
    })

    it('formats score to one decimal place', () => {
      render(<SeverityBadge score={9.567} />)

      expect(screen.getByText('9.6')).toBeInTheDocument()
    })
  })

  describe('label display', () => {
    it('hides label by default', () => {
      render(<SeverityBadge score={9.5} />)

      expect(screen.queryByText('Critical')).not.toBeInTheDocument()
    })

    it('shows label when showLabel is true', () => {
      render(<SeverityBadge score={9.5} showLabel />)

      expect(screen.getByText('Critical')).toBeInTheDocument()
    })

    it('shows label when both showScore and showLabel are false', () => {
      render(<SeverityBadge score={9.5} showScore={false} showLabel={false} />)

      expect(screen.getByText('Critical')).toBeInTheDocument()
    })
  })

  describe('severity prop', () => {
    it('uses provided severity over calculated severity', () => {
      render(<SeverityBadge score={9.5} severity="low" showLabel />)

      expect(screen.getByText('Low')).toBeInTheDocument()
    })

    it('renders each severity level correctly', () => {
      const { rerender } = render(<SeverityBadge severity="critical" showLabel showScore={false} />)
      expect(screen.getByText('Critical')).toBeInTheDocument()

      rerender(<SeverityBadge severity="high" showLabel showScore={false} />)
      expect(screen.getByText('High')).toBeInTheDocument()

      rerender(<SeverityBadge severity="medium" showLabel showScore={false} />)
      expect(screen.getByText('Medium')).toBeInTheDocument()

      rerender(<SeverityBadge severity="low" showLabel showScore={false} />)
      expect(screen.getByText('Low')).toBeInTheDocument()

      rerender(<SeverityBadge severity="info" showLabel showScore={false} />)
      expect(screen.getByText('Info')).toBeInTheDocument()
    })
  })

  describe('size prop', () => {
    it('applies xs size classes', () => {
      const { container } = render(<SeverityBadge score={9.5} size="xs" />)
      expect(container.firstChild.className).toContain('text-xs')
    })

    it('applies sm size classes by default', () => {
      const { container } = render(<SeverityBadge score={9.5} />)
      expect(container.firstChild.className).toContain('text-xs')
    })

    it('applies md size classes', () => {
      const { container } = render(<SeverityBadge score={9.5} size="md" />)
      expect(container.firstChild.className).toContain('text-sm')
    })

    it('applies lg size classes', () => {
      const { container } = render(<SeverityBadge score={9.5} size="lg" />)
      expect(container.firstChild.className).toContain('text-base')
    })
  })

  describe('styling', () => {
    it('applies critical styling for critical severity', () => {
      const { container } = render(<SeverityBadge score={9.5} />)
      expect(container.firstChild.className).toContain('text-red-400')
    })

    it('applies high styling for high severity', () => {
      const { container } = render(<SeverityBadge score={7.5} />)
      expect(container.firstChild.className).toContain('text-orange-400')
    })

    it('applies custom className', () => {
      const { container } = render(<SeverityBadge score={9.5} className="custom-class" />)
      expect(container.firstChild.className).toContain('custom-class')
    })
  })
})

describe('SeverityDot', () => {
  it('renders with correct title', () => {
    const { container } = render(<SeverityDot score={9.5} />)

    expect(container.firstChild).toHaveAttribute('title', 'Critical')
  })

  it('uses severity prop over score', () => {
    const { container } = render(<SeverityDot score={9.5} severity="low" />)

    expect(container.firstChild).toHaveAttribute('title', 'Low')
  })

  it('applies custom className', () => {
    const { container } = render(<SeverityDot score={9.5} className="custom-dot" />)

    expect(container.firstChild.className).toContain('custom-dot')
  })
})

describe('SeverityBar', () => {
  it('renders progress bar with correct width', () => {
    const { container } = render(<SeverityBar score={5.0} />)

    const progressBar = container.querySelector('[style]')
    expect(progressBar.style.width).toBe('50%')
  })

  it('renders 0% for null score', () => {
    const { container } = render(<SeverityBar score={null} />)

    const progressBar = container.querySelector('[style]')
    expect(progressBar.style.width).toBe('0%')
  })

  it('renders 100% for score of 10', () => {
    const { container } = render(<SeverityBar score={10} />)

    const progressBar = container.querySelector('[style]')
    expect(progressBar.style.width).toBe('100%')
  })
})

describe('EPSSBadge', () => {
  it('returns null for null score', () => {
    const { container } = render(<EPSSBadge score={null} />)

    expect(container.firstChild).toBeNull()
  })

  it('returns null for undefined score', () => {
    const { container } = render(<EPSSBadge score={undefined} />)

    expect(container.firstChild).toBeNull()
  })

  it('displays percentage correctly', () => {
    render(<EPSSBadge score={0.5} />)

    expect(screen.getByText('50.00%')).toBeInTheDocument()
  })

  it('displays EPSS label', () => {
    render(<EPSSBadge score={0.1} />)

    expect(screen.getByText('EPSS')).toBeInTheDocument()
  })

  it('applies elevated styling for high scores', () => {
    const { container } = render(<EPSSBadge score={0.15} />)

    expect(container.firstChild.className).toContain('text-orange-400')
  })

  it('applies normal styling for low scores', () => {
    const { container } = render(<EPSSBadge score={0.05} />)

    expect(container.firstChild.className).toContain('text-gray-400')
  })

  it('includes percentile in title when provided', () => {
    const { container } = render(<EPSSBadge score={0.1} percentile={0.95} />)

    expect(container.firstChild).toHaveAttribute('title', expect.stringContaining('95th percentile'))
  })
})
