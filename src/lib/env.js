/**
 * Environment Variable Validation
 *
 * Validates required environment variables on app startup.
 * Fails fast with clear error messages if configuration is missing.
 */

// Required environment variables
const REQUIRED_VARS = [
  {
    name: 'VITE_SUPABASE_URL',
    description: 'Supabase project URL',
    example: 'https://xxxxx.supabase.co',
  },
  {
    name: 'VITE_SUPABASE_ANON_KEY',
    description: 'Supabase anonymous key',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  },
]

// Optional environment variables with defaults
const OPTIONAL_VARS = [
  {
    name: 'VITE_SENTRY_DSN',
    description: 'Sentry error tracking DSN',
    default: null,
  },
  {
    name: 'VITE_GROQ_API_KEY',
    description: 'Groq AI API key for summaries',
    default: null,
  },
  {
    name: 'VITE_APP_VERSION',
    description: 'Application version for Sentry releases',
    default: '0.0.0',
  },
]

/**
 * Validate all required environment variables
 * @throws {Error} If any required variables are missing
 */
export function validateEnv() {
  const missing = []
  const warnings = []

  // Check required variables
  for (const { name, description, example } of REQUIRED_VARS) {
    const value = import.meta.env[name]
    if (!value) {
      missing.push({ name, description, example })
    }
  }

  // If any required vars are missing, throw an error
  if (missing.length > 0) {
    const message = formatMissingVarsError(missing)

    // In development, show a detailed error
    if (import.meta.env.DEV) {
      console.error(message)
      // Show an alert in development for visibility
      throw new Error(message)
    }

    // In production, log and throw a generic error
    console.error('[ENV] Missing required environment variables:', missing.map(v => v.name))
    throw new Error('Application configuration error. Please contact support.')
  }

  // Check optional variables and log warnings
  for (const { name, description, default: defaultValue } of OPTIONAL_VARS) {
    const value = import.meta.env[name]
    if (!value && defaultValue === null) {
      warnings.push({ name, description })
    }
  }

  // Log warnings for missing optional variables
  if (warnings.length > 0 && import.meta.env.DEV) {
    console.warn(
      '[ENV] Optional environment variables not configured:',
      warnings.map(v => `${v.name} (${v.description})`).join(', ')
    )
  }

  return true
}

/**
 * Format a helpful error message for missing variables
 */
function formatMissingVarsError(missing) {
  const lines = [
    '╔══════════════════════════════════════════════════════════════════╗',
    '║          MISSING REQUIRED ENVIRONMENT VARIABLES                  ║',
    '╠══════════════════════════════════════════════════════════════════╣',
  ]

  for (const { name, description, example } of missing) {
    lines.push(`║ ${name}`)
    lines.push(`║   Description: ${description}`)
    lines.push(`║   Example: ${example}`)
    lines.push('║')
  }

  lines.push('╠══════════════════════════════════════════════════════════════════╣')
  lines.push('║ Please add these variables to your .env file:                    ║')
  lines.push('║                                                                  ║')

  for (const { name, example } of missing) {
    lines.push(`║   ${name}=${example}`)
  }

  lines.push('║                                                                  ║')
  lines.push('║ See .env.example for a complete list of configuration options.  ║')
  lines.push('╚══════════════════════════════════════════════════════════════════╝')

  return lines.join('\n')
}

/**
 * Get an environment variable with optional default
 * @param {string} name - Variable name (without VITE_ prefix)
 * @param {string} defaultValue - Default value if not set
 */
export function getEnv(name, defaultValue = '') {
  return import.meta.env[`VITE_${name}`] || defaultValue
}

/**
 * Check if an optional feature is enabled
 * @param {string} name - Feature name (e.g., 'SENTRY_DSN')
 */
export function hasFeature(name) {
  return !!import.meta.env[`VITE_${name}`]
}

/**
 * Get all environment info for debugging
 * Only available in development
 */
export function getEnvDebugInfo() {
  if (!import.meta.env.DEV) {
    return { mode: import.meta.env.MODE }
  }

  return {
    mode: import.meta.env.MODE,
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL ? '✓ configured' : '✗ missing',
    supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY ? '✓ configured' : '✗ missing',
    sentryDsn: import.meta.env.VITE_SENTRY_DSN ? '✓ configured' : '○ optional',
    groqKey: import.meta.env.VITE_GROQ_API_KEY ? '✓ configured' : '○ optional',
    appVersion: import.meta.env.VITE_APP_VERSION || 'not set',
  }
}

export default {
  validate: validateEnv,
  get: getEnv,
  hasFeature,
  getDebugInfo: getEnvDebugInfo,
}
