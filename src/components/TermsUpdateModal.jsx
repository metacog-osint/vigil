/**
 * Terms Update Modal
 *
 * Shown when terms have been updated and user must re-accept.
 * Blocks all other interactions until accepted.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function TermsUpdateModal({ termsVersion, onAccept, accepting, error }) {
  const [checked, setChecked] = useState(false)

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Unknown'
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyber-accent/20 to-purple-500/20 px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyber-accent/20 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-cyber-accent"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Updated Terms & Privacy Policy</h2>
              <p className="text-sm text-gray-400">Version {termsVersion?.version || '1.0.0'}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <p className="text-gray-300 mb-4">
            We&apos;ve updated our Terms of Service and Privacy Policy. Please review the changes
            and accept to continue using Vigil.
          </p>

          {/* What changed */}
          {termsVersion?.summary && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-medium text-white mb-2">What&apos;s Changed</h3>
              <p className="text-sm text-gray-400">{termsVersion.summary}</p>
            </div>
          )}

          {/* Update dates */}
          <div className="flex gap-4 text-sm text-gray-400 mb-6">
            <div>
              <span className="text-gray-500">Terms updated:</span>{' '}
              {formatDate(termsVersion?.terms_updated_at)}
            </div>
            <div>
              <span className="text-gray-500">Privacy updated:</span>{' '}
              {formatDate(termsVersion?.privacy_updated_at)}
            </div>
          </div>

          {/* Links to documents */}
          <div className="flex gap-4 mb-6">
            <Link
              to="/terms"
              target="_blank"
              className="flex items-center gap-2 text-cyber-accent hover:underline text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              View Terms of Service
            </Link>
            <Link
              to="/privacy"
              target="_blank"
              className="flex items-center gap-2 text-cyber-accent hover:underline text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              View Privacy Policy
            </Link>
          </div>

          {/* Acceptance checkbox */}
          <div className="flex items-start gap-3 mb-6">
            <input
              id="accept-updated-terms"
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-gray-600 bg-gray-800 text-cyber-accent focus:ring-cyber-accent focus:ring-offset-0 focus:ring-2"
            />
            <label htmlFor="accept-updated-terms" className="text-sm text-gray-300">
              I have read and agree to the updated{' '}
              <Link to="/terms" target="_blank" className="text-cyber-accent hover:underline">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" target="_blank" className="text-cyber-accent hover:underline">
                Privacy Policy
              </Link>
            </label>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Accept button */}
          <button
            onClick={onAccept}
            disabled={!checked || accepting}
            className="w-full px-4 py-3 bg-cyber-accent text-black font-semibold rounded-lg hover:bg-cyber-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {accepting ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Accepting...
              </>
            ) : (
              'Accept and Continue'
            )}
          </button>
        </div>

        {/* Footer note */}
        <div className="px-6 py-3 bg-gray-800/50 border-t border-gray-700">
          <p className="text-xs text-gray-500 text-center">
            By continuing to use Vigil, you acknowledge that you have read and understood the
            updated terms.
          </p>
        </div>
      </div>
    </div>
  )
}
