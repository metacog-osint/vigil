/**
 * Copy Button Component
 *
 * A button that copies text to clipboard with visual feedback.
 * Uses the toast notification system for confirmation.
 */

import { useState, useCallback } from 'react'
import { clsx } from 'clsx'
import { useToast } from '../contexts/ToastContext'

// Copy icon
const CopyIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
)

// Check icon (shown after copy)
const CheckIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
)

/**
 * Copy button with tooltip
 *
 * @param {Object} props
 * @param {string} props.text - The text to copy
 * @param {string} props.label - Optional label to show in toast (default: "Copied to clipboard")
 * @param {string} props.size - Button size: 'sm', 'md', 'lg' (default: 'sm')
 * @param {string} props.variant - Style variant: 'ghost', 'outline' (default: 'ghost')
 * @param {boolean} props.showLabel - Whether to show "Copy" label (default: false)
 * @param {string} props.className - Additional CSS classes
 */
export default function CopyButton({
  text,
  label,
  size = 'sm',
  variant = 'ghost',
  showLabel = false,
  className,
}) {
  const [copied, setCopied] = useState(false)
  const toast = useToast()

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.copy(label || 'Copied to clipboard')

      // Reset after 2 seconds
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
      toast.error('Failed to copy to clipboard')
    }
  }, [text, label, toast])

  const sizes = {
    sm: { button: 'p-1', icon: 'w-4 h-4' },
    md: { button: 'p-1.5', icon: 'w-5 h-5' },
    lg: { button: 'p-2', icon: 'w-6 h-6' },
  }

  const variants = {
    ghost: 'hover:bg-gray-800 text-gray-500 hover:text-gray-300',
    outline: 'border border-gray-700 hover:border-gray-600 bg-transparent text-gray-400 hover:text-white',
  }

  const s = sizes[size]

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={clsx(
        'rounded transition-all duration-200 flex items-center gap-1.5 click-scale',
        variants[variant],
        s.button,
        copied && 'text-green-400 hover:text-green-400',
        className
      )}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
      aria-label={copied ? 'Copied!' : `Copy ${text} to clipboard`}
    >
      {copied ? (
        <CheckIcon className={s.icon} />
      ) : (
        <CopyIcon className={s.icon} />
      )}
      {showLabel && (
        <span className="text-xs">{copied ? 'Copied' : 'Copy'}</span>
      )}
    </button>
  )
}

/**
 * Inline copy wrapper - wraps text with a copy button
 */
export function CopyableText({ children, text, className }) {
  const textToCopy = text || (typeof children === 'string' ? children : '')

  return (
    <span className={clsx('inline-flex items-center gap-1 group', className)}>
      <span className="font-mono">{children}</span>
      <CopyButton
        text={textToCopy}
        size="sm"
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </span>
  )
}

/**
 * Code block with copy button
 */
export function CopyableCode({ children, language, className }) {
  const text = typeof children === 'string' ? children : ''

  return (
    <div className={clsx('relative group', className)}>
      <pre className="bg-gray-900 border border-gray-800 rounded-lg p-4 pr-12 overflow-x-auto">
        <code className={clsx('text-sm font-mono text-gray-300', language && `language-${language}`)}>
          {children}
        </code>
      </pre>
      <CopyButton
        text={text}
        size="md"
        variant="ghost"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800/80"
      />
    </div>
  )
}

/**
 * IOC/CVE specific copy button with formatted label
 */
export function CopyIOC({ value, type }) {
  const labels = {
    ip: 'IP address copied',
    domain: 'Domain copied',
    hash: 'Hash copied',
    url: 'URL copied',
    cve: 'CVE ID copied',
    default: 'Copied to clipboard',
  }

  return (
    <CopyButton
      text={value}
      label={labels[type] || labels.default}
      size="sm"
    />
  )
}
