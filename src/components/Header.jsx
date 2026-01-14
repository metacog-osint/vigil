import { useState } from 'react'
import { signOut, signInWithGoogle } from '../lib/firebase'
import { useNavigate } from 'react-router-dom'
import NotificationBell from './NotificationBell'

export default function Header({ onMenuClick, onSearchClick, user, isOnline }) {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const navigate = useNavigate()

  const handleSignOut = async () => {
    try {
      await signOut()
      setShowUserMenu(false)
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  const handleSignIn = async () => {
    try {
      await signInWithGoogle()
    } catch (error) {
      console.error('Sign in error:', error)
    }
  }

  return (
    <header className="h-16 bg-cyber-dark border-b border-gray-800 flex items-center justify-between px-4">
      {/* Left side */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-800"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Live indicator */}
        <div className="flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 live-indicator' : 'bg-yellow-500'}`}></span>
          <span className="text-gray-400">{isOnline ? 'Live' : 'Offline'}</span>
        </div>

        {/* Last updated */}
        <div className="hidden sm:block text-xs text-gray-500">
          Last sync: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        {/* Quick search button */}
        <button
          onClick={onSearchClick}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-gray-600 hover:text-gray-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span>Search...</span>
          <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.5 text-xs text-gray-500 bg-gray-800 border border-gray-700 rounded">
            ⌘K
          </kbd>
        </button>

        {/* Notifications */}
        <NotificationBell userId={user?.uid || 'anonymous'} />

        {/* User menu */}
        <div className="relative">
          {user ? (
            <>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-800"
              >
                <div className="w-8 h-8 bg-cyber-accent/20 rounded-full flex items-center justify-center">
                  <span className="text-cyber-accent text-sm font-medium">
                    {user.email?.[0].toUpperCase() || 'U'}
                  </span>
                </div>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-cyber-dark border border-gray-800 rounded-lg shadow-lg py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-800">
                    <div className="text-sm text-white truncate">{user.email}</div>
                    <div className="text-xs text-gray-500">Analyst</div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full px-4 py-2 text-left text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </>
          ) : (
            <button
              onClick={handleSignIn}
              className="cyber-button-primary text-sm"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
