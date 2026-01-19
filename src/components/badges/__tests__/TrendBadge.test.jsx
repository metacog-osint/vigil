import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TrendBadge, { TrendIndicator } from '../TrendBadge'

describe('TrendBadge', () => {
  describe('rendering', () => {
    it('renders ESCALATING status correctly', () => {
      render(<TrendBadge status="ESCALATING" />)

      expect(screen.getByText('Escalating')).toBeInTheDocument()
      expect(screen.getByText('↑')).toBeInTheDocument()
    })

    it('renders DECLINING status correctly', () => {
      render(<TrendBadge status="DECLINING" />)

      expect(screen.getByText('Declining')).toBeInTheDocument()
      expect(screen.getByText('↓')).toBeInTheDocument()
    })

    it('renders STABLE status correctly', () => {
      render(<TrendBadge status="STABLE" />)

      expect(screen.getByText('Stable')).toBeInTheDocument()
      expect(screen.getByText('→')).toBeInTheDocument()
    })

    it('defaults to STABLE for unknown status', () => {
      render(<TrendBadge status="UNKNOWN" />)

      expect(screen.getByText('Stable')).toBeInTheDocument()
    })

    it('defaults to STABLE for null status', () => {
      render(<TrendBadge status={null} />)

      expect(screen.getByText('Stable')).toBeInTheDocument()
    })
  })

  describe('showLabel prop', () => {
    it('hides label when showLabel is false', () => {
      render(<TrendBadge status="ESCALATING" showLabel={false} />)

      expect(screen.queryByText('Escalating')).not.toBeInTheDocument()
      expect(screen.getByText('↑')).toBeInTheDocument()
    })

    it('shows label by default', () => {
      render(<TrendBadge status="ESCALATING" />)

      expect(screen.getByText('Escalating')).toBeInTheDocument()
    })
  })

  describe('size prop', () => {
    it('applies small size classes by default', () => {
      const { container } = render(<TrendBadge status="ESCALATING" />)

      const badge = container.firstChild
      expect(badge.className).toContain('text-xs')
    })

    it('applies medium size classes when size is md', () => {
      const { container } = render(<TrendBadge status="ESCALATING" size="md" />)

      const badge = container.firstChild
      expect(badge.className).toContain('text-sm')
    })
  })

  describe('styling', () => {
    it('applies red styling for ESCALATING', () => {
      const { container } = render(<TrendBadge status="ESCALATING" />)

      const badge = container.firstChild
      expect(badge.className).toContain('text-red-400')
    })

    it('applies green styling for DECLINING', () => {
      const { container } = render(<TrendBadge status="DECLINING" />)

      const badge = container.firstChild
      expect(badge.className).toContain('text-green-400')
    })

    it('applies gray styling for STABLE', () => {
      const { container } = render(<TrendBadge status="STABLE" />)

      const badge = container.firstChild
      expect(badge.className).toContain('text-gray-400')
    })
  })
})

describe('TrendIndicator', () => {
  it('renders up arrow for ESCALATING', () => {
    render(<TrendIndicator status="ESCALATING" />)

    expect(screen.getByText('▲')).toBeInTheDocument()
  })

  it('renders down arrow for DECLINING', () => {
    render(<TrendIndicator status="DECLINING" />)

    expect(screen.getByText('▼')).toBeInTheDocument()
  })

  it('renders dot for STABLE', () => {
    render(<TrendIndicator status="STABLE" />)

    expect(screen.getByText('●')).toBeInTheDocument()
  })

  it('has title attribute with status', () => {
    render(<TrendIndicator status="ESCALATING" />)

    const indicator = screen.getByText('▲')
    expect(indicator).toHaveAttribute('title', 'ESCALATING')
  })

  it('defaults to STABLE title for null status', () => {
    render(<TrendIndicator status={null} />)

    const indicator = screen.getByText('●')
    expect(indicator).toHaveAttribute('title', 'STABLE')
  })
})
