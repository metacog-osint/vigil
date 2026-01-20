/**
 * Demo Mode Banner
 *
 * Shown at the top of the screen when viewing the interactive demo.
 * Includes CTA to sign up for a real account.
 */

import { Link } from 'react-router-dom'
import { useDemo } from '../../contexts/DemoContext'

export default function DemoBanner() {
  const { isDemoMode, exitDemoMode } = useDemo()

  if (!isDemoMode) return null

  return (
    <div className="bg-gradient-to-r from-cyber-accent/20 via-cyber-accent/10 to-cyber-accent/20 border-b border-cyber-accent/30">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 px-2 py-0.5 bg-cyber-accent/20 border border-cyber-accent/40 rounded text-xs font-medium text-cyber-accent">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
            DEMO MODE
          </span>
          <span className="text-sm text-gray-300">
            You&apos;re viewing <span className="text-white font-medium">sample data</span> — Sign
            up to see real threat intelligence
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exitDemoMode}
            className="px-4 py-1.5 bg-cyber-accent text-black text-sm font-semibold rounded-lg hover:bg-cyber-accent/90 transition-colors"
          >
            Create Free Account
          </button>
          <Link to="/" className="text-sm text-gray-400 hover:text-white transition-colors">
            Exit Demo
          </Link>
        </div>
      </div>
    </div>
  )
}
