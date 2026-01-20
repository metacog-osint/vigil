/**
 * Session Warning Modal
 *
 * Shown before session timeout to give user a chance to extend.
 */

export default function SessionWarningModal({ minutes, onExtend, onDismiss }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-yellow-500/30 rounded-xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-yellow-500/10 px-6 py-4 border-b border-yellow-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-yellow-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Session Expiring Soon</h2>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <p className="text-gray-300 mb-6">
            Your session will expire in{' '}
            <span className="text-yellow-400 font-semibold">{minutes} minutes</span> due to
            inactivity. Click below to stay signed in.
          </p>

          <div className="flex gap-3">
            <button
              onClick={onExtend}
              className="flex-1 px-4 py-2.5 bg-cyber-accent text-black font-semibold rounded-lg hover:bg-cyber-accent/90 transition-colors"
            >
              Stay Signed In
            </button>
            <button
              onClick={onDismiss}
              className="px-4 py-2.5 bg-gray-800 text-gray-300 font-medium rounded-lg hover:bg-gray-700 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-800/50 border-t border-gray-700">
          <p className="text-xs text-gray-500 text-center">
            For security, sessions automatically expire after 30 minutes of inactivity.
          </p>
        </div>
      </div>
    </div>
  )
}
