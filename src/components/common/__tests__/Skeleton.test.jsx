/**
 * Tests for Skeleton components
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  Skeleton,
  SkeletonLine,
  SkeletonAvatar,
  SkeletonBadge,
  SkeletonButton,
  SkeletonCard,
  SkeletonTable,
  SkeletonStats,
  SkeletonList,
  SkeletonChart,
  SkeletonDetailPanel,
  SkeletonPage,
  SkeletonActorCard,
  SkeletonActorGrid,
  SkeletonDashboard,
} from '../Skeleton'

describe('Skeleton Components', () => {
  describe('Skeleton (Base)', () => {
    it('renders with default styling', () => {
      render(<Skeleton data-testid="skeleton" />)
      const skeleton = screen.getByTestId('skeleton')
      expect(skeleton).toBeInTheDocument()
      expect(skeleton).toHaveClass('animate-pulse')
    })

    it('applies custom className', () => {
      render(<Skeleton className="custom-class" data-testid="skeleton" />)
      const skeleton = screen.getByTestId('skeleton')
      expect(skeleton).toHaveClass('custom-class')
    })

    it('passes through additional props', () => {
      render(<Skeleton data-testid="skeleton" aria-label="Loading" />)
      const skeleton = screen.getByTestId('skeleton')
      expect(skeleton).toHaveAttribute('aria-label', 'Loading')
    })
  })

  describe('SkeletonLine', () => {
    it('renders with default dimensions', () => {
      const { container } = render(<SkeletonLine />)
      const line = container.firstChild
      expect(line).toHaveStyle({ width: '100%', height: '1rem' })
    })

    it('renders with custom width and height', () => {
      const { container } = render(<SkeletonLine width="50%" height="2rem" />)
      const line = container.firstChild
      expect(line).toHaveStyle({ width: '50%', height: '2rem' })
    })

    it('applies custom className', () => {
      const { container } = render(<SkeletonLine className="my-class" />)
      const line = container.firstChild
      expect(line).toHaveClass('my-class')
    })
  })

  describe('SkeletonAvatar', () => {
    it('renders with default medium size', () => {
      const { container } = render(<SkeletonAvatar />)
      const avatar = container.firstChild
      expect(avatar).toHaveClass('rounded-full', 'w-10', 'h-10')
    })

    it('renders with small size', () => {
      const { container } = render(<SkeletonAvatar size="sm" />)
      const avatar = container.firstChild
      expect(avatar).toHaveClass('w-8', 'h-8')
    })

    it('renders with large size', () => {
      const { container } = render(<SkeletonAvatar size="lg" />)
      const avatar = container.firstChild
      expect(avatar).toHaveClass('w-12', 'h-12')
    })

    it('renders with extra large size', () => {
      const { container } = render(<SkeletonAvatar size="xl" />)
      const avatar = container.firstChild
      expect(avatar).toHaveClass('w-16', 'h-16')
    })
  })

  describe('SkeletonBadge', () => {
    it('renders with badge styling', () => {
      const { container } = render(<SkeletonBadge />)
      const badge = container.firstChild
      expect(badge).toHaveClass('h-5', 'w-16', 'rounded-full')
    })
  })

  describe('SkeletonButton', () => {
    it('renders with default medium size', () => {
      const { container } = render(<SkeletonButton />)
      const button = container.firstChild
      expect(button).toHaveClass('h-10', 'w-24', 'rounded-lg')
    })

    it('renders with small size', () => {
      const { container } = render(<SkeletonButton size="sm" />)
      const button = container.firstChild
      expect(button).toHaveClass('h-8', 'w-20')
    })

    it('renders with large size', () => {
      const { container } = render(<SkeletonButton size="lg" />)
      const button = container.firstChild
      expect(button).toHaveClass('h-12', 'w-32')
    })
  })

  describe('SkeletonCard', () => {
    it('renders with card structure', () => {
      const { container } = render(<SkeletonCard />)
      expect(container.querySelector('.cyber-card')).toBeInTheDocument()
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    })

    it('applies custom className', () => {
      const { container } = render(<SkeletonCard className="my-card" />)
      expect(container.firstChild).toHaveClass('my-card')
    })
  })

  describe('SkeletonTable', () => {
    it('renders default 5 rows and 4 columns', () => {
      const { container } = render(<SkeletonTable />)
      // Header + 5 rows = 6 rows total
      const rows = container.querySelectorAll('.flex.gap-4')
      expect(rows.length).toBe(6)
    })

    it('renders custom number of rows and columns', () => {
      const { container } = render(<SkeletonTable rows={3} cols={2} />)
      // Header + 3 rows = 4 rows total
      const rows = container.querySelectorAll('.flex.gap-4')
      expect(rows.length).toBe(4)
    })
  })

  describe('SkeletonStats', () => {
    it('renders default 4 stat cards', () => {
      const { container } = render(<SkeletonStats />)
      const cards = container.querySelectorAll('.cyber-card')
      expect(cards.length).toBe(4)
    })

    it('renders custom count of stat cards', () => {
      const { container } = render(<SkeletonStats count={6} />)
      const cards = container.querySelectorAll('.cyber-card')
      expect(cards.length).toBe(6)
    })
  })

  describe('SkeletonList', () => {
    it('renders default 5 list items', () => {
      const { container } = render(<SkeletonList />)
      const items = container.querySelectorAll('.cyber-card')
      expect(items.length).toBe(5)
    })

    it('renders custom number of items', () => {
      const { container } = render(<SkeletonList items={3} />)
      const items = container.querySelectorAll('.cyber-card')
      expect(items.length).toBe(3)
    })
  })

  describe('SkeletonChart', () => {
    it('renders with default height', () => {
      const { container } = render(<SkeletonChart />)
      expect(container.querySelector('.h-64')).toBeInTheDocument()
    })

    it('renders with custom height', () => {
      const { container } = render(<SkeletonChart height="h-96" />)
      expect(container.querySelector('.h-96')).toBeInTheDocument()
    })

    it('has card wrapper', () => {
      const { container } = render(<SkeletonChart />)
      expect(container.querySelector('.cyber-card')).toBeInTheDocument()
    })
  })

  describe('SkeletonDetailPanel', () => {
    it('renders header with avatar', () => {
      const { container } = render(<SkeletonDetailPanel />)
      expect(container.querySelector('.rounded-full')).toBeInTheDocument()
    })

    it('renders stats row with 3 items', () => {
      const { container } = render(<SkeletonDetailPanel />)
      const gridItems = container.querySelectorAll('.grid-cols-3 .cyber-card')
      expect(gridItems.length).toBe(3)
    })
  })

  describe('SkeletonPage', () => {
    it('renders header section', () => {
      const { container } = render(<SkeletonPage />)
      // Should have header with title and button
      const buttons = container.querySelectorAll('.rounded-lg')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('renders filter section', () => {
      const { container } = render(<SkeletonPage />)
      // Filter inputs
      const filters = container.querySelectorAll('.h-10')
      expect(filters.length).toBeGreaterThan(0)
    })

    it('renders table content', () => {
      const { container } = render(<SkeletonPage />)
      // Should have table rows
      const rows = container.querySelectorAll('.flex.gap-4')
      expect(rows.length).toBeGreaterThan(0)
    })
  })

  describe('SkeletonActorCard', () => {
    it('renders with avatar', () => {
      const { container } = render(<SkeletonActorCard />)
      expect(container.querySelector('.rounded-full')).toBeInTheDocument()
    })

    it('renders with badges', () => {
      const { container } = render(<SkeletonActorCard />)
      // Multiple badge-like elements
      const badges = container.querySelectorAll('.rounded-full')
      expect(badges.length).toBeGreaterThan(1)
    })

    it('applies custom className', () => {
      const { container } = render(<SkeletonActorCard className="custom" />)
      expect(container.firstChild).toHaveClass('custom')
    })
  })

  describe('SkeletonActorGrid', () => {
    it('renders default 6 actor cards', () => {
      const { container } = render(<SkeletonActorGrid />)
      const cards = container.querySelectorAll('.cyber-card')
      expect(cards.length).toBe(6)
    })

    it('renders custom count of actor cards', () => {
      const { container } = render(<SkeletonActorGrid count={4} />)
      const cards = container.querySelectorAll('.cyber-card')
      expect(cards.length).toBe(4)
    })

    it('has responsive grid layout', () => {
      const { container } = render(<SkeletonActorGrid />)
      expect(container.firstChild).toHaveClass('grid', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3')
    })
  })

  describe('SkeletonDashboard', () => {
    it('renders header section', () => {
      const { container } = render(<SkeletonDashboard />)
      // Should have multiple skeleton elements
      const skeletons = container.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })

    it('renders stats section', () => {
      const { container } = render(<SkeletonDashboard />)
      // Stats cards in grid
      const grid = container.querySelector('.grid-cols-2')
      expect(grid).toBeInTheDocument()
    })

    it('renders main content grid', () => {
      const { container } = render(<SkeletonDashboard />)
      const mainGrid = container.querySelector('.lg\\:grid-cols-3')
      expect(mainGrid).toBeInTheDocument()
    })
  })
})
