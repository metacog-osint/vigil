import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary, ErrorFallback, ErrorMessage } from '../ErrorBoundary'

// Mock the sentry module
vi.mock('../../../lib/sentry', () => ({
  captureException: vi.fn(),
}))

// Component that throws an error
function ThrowError({ shouldThrow }) {
  if (shouldThrow) {
    throw new Error('Test error message')
  }
  return <div>No error</div>
}

describe('ErrorBoundary', () => {
  // Suppress console.error for expected errors
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('normal rendering', () => {
    it('renders children when no error', () => {
      render(
        <ErrorBoundary>
          <div>Child content</div>
        </ErrorBoundary>
      )

      expect(screen.getByText('Child content')).toBeInTheDocument()
    })
  })

  describe('error handling', () => {
    it('shows error fallback when child throws', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })

    it('uses custom fallback when provided', () => {
      render(
        <ErrorBoundary fallback={<div>Custom fallback</div>}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText('Custom fallback')).toBeInTheDocument()
    })

    it('uses custom title when provided', () => {
      render(
        <ErrorBoundary title="Custom error title">
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText('Custom error title')).toBeInTheDocument()
    })

    it('shows retry button', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    })

    it('resets error state on retry', async () => {
      let shouldThrow = true

      function ConditionalError() {
        if (shouldThrow) {
          throw new Error('Error')
        }
        return <div>Recovered</div>
      }

      const { rerender } = render(
        <ErrorBoundary>
          <ConditionalError />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()

      // Fix the error
      shouldThrow = false

      // Click retry
      fireEvent.click(screen.getByRole('button', { name: /try again/i }))

      // Re-render to trigger the boundary to try again
      rerender(
        <ErrorBoundary>
          <ConditionalError />
        </ErrorBoundary>
      )

      expect(screen.getByText('Recovered')).toBeInTheDocument()
    })
  })
})

describe('ErrorFallback', () => {
  it('displays error message', () => {
    const error = new Error('Test error')
    render(<ErrorFallback error={error} />)

    expect(screen.getByText('Test error')).toBeInTheDocument()
  })

  it('displays default message when error has no message', () => {
    render(<ErrorFallback error={{}} />)

    expect(screen.getByText(/unexpected error/i)).toBeInTheDocument()
  })

  it('shows retry button when onRetry provided', () => {
    const onRetry = vi.fn()
    render(<ErrorFallback error={new Error('Test')} onRetry={onRetry} />)

    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('calls onRetry when button clicked', () => {
    const onRetry = vi.fn()
    render(<ErrorFallback error={new Error('Test')} onRetry={onRetry} />)

    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('hides retry button when onRetry not provided', () => {
    render(<ErrorFallback error={new Error('Test')} />)

    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
  })

  it('uses custom title', () => {
    render(<ErrorFallback error={new Error('Test')} title="Custom Title" />)

    expect(screen.getByText('Custom Title')).toBeInTheDocument()
  })
})

describe('ErrorMessage', () => {
  it('displays message', () => {
    render(<ErrorMessage message="Error occurred" />)

    expect(screen.getByText('Error occurred')).toBeInTheDocument()
  })

  it('shows dismiss button when onDismiss provided', () => {
    const onDismiss = vi.fn()
    render(<ErrorMessage message="Error" onDismiss={onDismiss} />)

    const dismissButton = screen.getByRole('button')
    expect(dismissButton).toBeInTheDocument()
  })

  it('calls onDismiss when dismiss button clicked', () => {
    const onDismiss = vi.fn()
    render(<ErrorMessage message="Error" onDismiss={onDismiss} />)

    fireEvent.click(screen.getByRole('button'))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('hides dismiss button when onDismiss not provided', () => {
    render(<ErrorMessage message="Error" />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
