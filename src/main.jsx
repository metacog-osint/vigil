import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { registerServiceWorker } from './lib/serviceWorker'
import { initSentry } from './lib/sentry'
import { validateEnv } from './lib/env'

// Validate environment variables before anything else
try {
  validateEnv()
} catch (error) {
  // In development, show the error overlay
  if (import.meta.env.DEV) {
    const root = document.getElementById('root')
    root.innerHTML = `
      <div style="padding: 20px; font-family: monospace; background: #1a1a2e; color: #ff6b6b; min-height: 100vh;">
        <h1 style="color: #ff6b6b;">Configuration Error</h1>
        <pre style="white-space: pre-wrap; background: #16213e; padding: 20px; border-radius: 8px; color: #eee;">${error.message}</pre>
      </div>
    `
    throw error
  }
  // In production, log and continue (Sentry will catch it)
  console.error('[Config] Environment validation failed:', error)
}

// Initialize Sentry before app renders (only in production)
if (import.meta.env.PROD) {
  initSentry()
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)

// Register service worker for offline support
if (import.meta.env.PROD) {
  registerServiceWorker()
}
