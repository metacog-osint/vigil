// Environment loader for ingestion scripts
// Reads .env file and exports Supabase credentials

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '..', '.env')

try {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      const value = valueParts.join('=')
      if (key && value && !process.env[key]) {
        process.env[key] = value
      }
    }
  }
} catch (e) {
  console.warn('Could not load .env file:', e.message)
}

export const supabaseUrl = process.env.VITE_SUPABASE_URL
export const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

// Threat Intelligence API Keys
export const otxApiKey = process.env.OTX_API_KEY
export const abusechApiKey = process.env.ABUSECH_API_KEY
export const greynoiseApiKey = process.env.GREYNOISE_API_KEY
export const virustotalApiKey = process.env.VIRUSTOTAL_API_KEY
export const hybridAnalysisApiKey = process.env.HYBRID_ANALYSIS_API_KEY
