/**
 * Logger Utility
 * Provides environment-aware logging that only outputs in development
 */

const isDev = import.meta.env.DEV

/**
 * Logger with environment-aware output
 * - debug/info only log in development
 * - warn/error always log (important for production debugging)
 */
export const logger = {
  /**
   * Debug-level logging (dev only)
   */
  debug: (...args) => {
    if (isDev) {
      console.debug('[DEBUG]', ...args)
    }
  },

  /**
   * Info-level logging (dev only)
   */
  info: (...args) => {
    if (isDev) {
      console.info('[INFO]', ...args)
    }
  },

  /**
   * Warning-level logging (always logs)
   */
  warn: (...args) => {
    console.warn('[WARN]', ...args)
  },

  /**
   * Error-level logging (always logs)
   */
  error: (...args) => {
    console.error('[ERROR]', ...args)
  },

  /**
   * Log with custom level
   */
  log: (level, ...args) => {
    if (logger[level]) {
      logger[level](...args)
    } else if (isDev) {
      console.log(`[${level.toUpperCase()}]`, ...args)
    }
  },
}

export default logger
