import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  LoadingState,
  EmptyState,
  ErrorState,
  InlineSpinner,
  FullPageLoader,
} from '../LoadingState'

describe('LoadingState', () => {
  describe('loading state', () => {
    it('shows default skeleton when loading', () => {
      const { container } = render(<LoadingState loading={true} data={null} />)

      // Default skeleton is table skeleton which has animate-pulse
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    })

    it('shows custom skeleton when provided', () => {
      render(
        <LoadingState
          loading={true}
          data={null}
          skeleton={<div data-testid="custom-skeleton">Loading...</div>}
        />
      )

      expect(screen.getByTestId('custom-skeleton')).toBeInTheDocument()
    })

    it('shows inline skeleton when skeletonType is inline', () => {
      const { container } = render(
        <LoadingState loading={true} data={null} skeletonType="inline" />
      )

      expect(container.querySelector('.animate-spin')).toBeInTheDocument()
    })

    it('shows full page loader when skeletonType is full', () => {
      render(<LoadingState loading={true} data={null} skeletonType="full" />)

      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })
  })

  describe('error state', () => {
    it('shows error when error prop is set', () => {
      const error = new Error('Test error')
      render(<LoadingState error={error} data={null} />)

      expect(screen.getByText('Failed to load')).toBeInTheDocument()
      expect(screen.getByText('Test error')).toBeInTheDocument()
    })

    it('shows retry button when onRetry provided', () => {
      const error = new Error('Test error')
      const onRetry = vi.fn()
      render(<LoadingState error={error} data={null} onRetry={onRetry} />)

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    })

    it('calls onRetry when retry button clicked', () => {
      const error = new Error('Test error')
      const onRetry = vi.fn()
      render(<LoadingState error={error} data={null} onRetry={onRetry} />)

      fireEvent.click(screen.getByRole('button', { name: /try again/i }))

      expect(onRetry).toHaveBeenCalledTimes(1)
    })
  })

  describe('empty state', () => {
    it('shows empty state for null data', () => {
      render(<LoadingState loading={false} data={null} />)

      expect(screen.getByText('No data found')).toBeInTheDocument()
    })

    it('shows empty state for empty array', () => {
      render(<LoadingState loading={false} data={[]} />)

      expect(screen.getByText('No data found')).toBeInTheDocument()
    })

    it('shows empty state for empty object', () => {
      render(<LoadingState loading={false} data={{}} />)

      expect(screen.getByText('No data found')).toBeInTheDocument()
    })

    it('shows custom empty message', () => {
      render(<LoadingState loading={false} data={[]} emptyMessage="No items available" />)

      expect(screen.getByText('No items available')).toBeInTheDocument()
    })

    it('shows custom empty action', () => {
      render(<LoadingState loading={false} data={[]} emptyAction={<button>Add Item</button>} />)

      expect(screen.getByRole('button', { name: 'Add Item' })).toBeInTheDocument()
    })
  })

  describe('success state', () => {
    it('renders children when data is present', () => {
      render(
        <LoadingState loading={false} data={[1, 2, 3]}>
          <div>Content</div>
        </LoadingState>
      )

      expect(screen.getByText('Content')).toBeInTheDocument()
    })

    it('renders children with non-empty object data', () => {
      render(
        <LoadingState loading={false} data={{ key: 'value' }}>
          <div>Object Content</div>
        </LoadingState>
      )

      expect(screen.getByText('Object Content')).toBeInTheDocument()
    })
  })

  describe('className prop', () => {
    it('applies className to wrapper', () => {
      const { container } = render(
        <LoadingState loading={false} data={[1]} className="custom-class">
          <div>Content</div>
        </LoadingState>
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })
  })

  describe('minHeight prop', () => {
    it('applies min-height when minHeight is true and in error state', () => {
      const { container } = render(<LoadingState error={new Error('Test')} data={null} minHeight />)

      expect(container.firstChild.className).toContain('min-h-')
    })
  })
})

describe('EmptyState', () => {
  it('renders default message', () => {
    render(<EmptyState />)

    expect(screen.getByText('No data found')).toBeInTheDocument()
  })

  it('renders custom message', () => {
    render(<EmptyState message="Custom empty message" />)

    expect(screen.getByText('Custom empty message')).toBeInTheDocument()
  })

  it('renders action when provided', () => {
    render(<EmptyState action={<button>Action</button>} />)

    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument()
  })
})

describe('ErrorState', () => {
  it('renders error message', () => {
    const error = new Error('Something bad happened')
    render(<ErrorState error={error} />)

    expect(screen.getByText('Something bad happened')).toBeInTheDocument()
  })

  it('renders default message when error has no message', () => {
    render(<ErrorState error={{}} />)

    expect(screen.getByText(/error occurred/i)).toBeInTheDocument()
  })

  it('renders retry button when onRetry provided', () => {
    render(<ErrorState error={new Error('Test')} onRetry={() => {}} />)

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})

describe('InlineSpinner', () => {
  it('renders with default size', () => {
    const { container } = render(<InlineSpinner />)

    expect(container.firstChild).toHaveClass('w-6', 'h-6')
  })

  it('renders with small size', () => {
    const { container } = render(<InlineSpinner size="sm" />)

    expect(container.firstChild).toHaveClass('w-4', 'h-4')
  })

  it('renders with large size', () => {
    const { container } = render(<InlineSpinner size="lg" />)

    expect(container.firstChild).toHaveClass('w-8', 'h-8')
  })

  it('applies custom className', () => {
    const { container } = render(<InlineSpinner className="custom-spinner" />)

    expect(container.firstChild).toHaveClass('custom-spinner')
  })

  it('has spin animation', () => {
    const { container } = render(<InlineSpinner />)

    expect(container.firstChild).toHaveClass('animate-spin')
  })
})

describe('FullPageLoader', () => {
  it('renders with default message', () => {
    render(<FullPageLoader />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders with custom message', () => {
    render(<FullPageLoader message="Please wait..." />)

    expect(screen.getByText('Please wait...')).toBeInTheDocument()
  })

  it('contains spinner', () => {
    const { container } = render(<FullPageLoader />)

    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })
})
