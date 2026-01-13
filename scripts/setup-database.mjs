#!/usr/bin/env node
/**
 * Database Setup Script
 *
 * Runs all database population steps in the correct order:
 * 1. MITRE ATT&CK techniques
 * 2. CISA KEV vulnerabilities (for CVE matches)
 * 3. Actor-CVE and Actor-TTP correlations
 *
 * Usage: npm run setup:db
 */

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

const steps = [
  { name: 'MITRE ATT&CK Techniques', script: 'ingest:mitre' },
  { name: 'CISA KEV Vulnerabilities', script: 'ingest:kev' },
  { name: 'Actor Correlations', script: 'seed:correlations' },
]

async function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32'
    const npm = isWindows ? 'npm.cmd' : 'npm'

    const child = spawn(npm, ['run', scriptName], {
      cwd: rootDir,
      stdio: 'inherit',
      shell: true,
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Script ${scriptName} exited with code ${code}`))
      }
    })

    child.on('error', reject)
  })
}

async function main() {
  console.log('╔════════════════════════════════════════╗')
  console.log('║       Vigil Database Setup             ║')
  console.log('╚════════════════════════════════════════╝')
  console.log()

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    console.log(`\n[${i + 1}/${steps.length}] ${step.name}...`)
    console.log('─'.repeat(40))

    try {
      await runScript(step.script)
      console.log(`✓ ${step.name} complete`)
    } catch (error) {
      console.error(`✗ ${step.name} failed: ${error.message}`)
      // Continue with other steps even if one fails
    }
  }

  console.log('\n╔════════════════════════════════════════╗')
  console.log('║       Setup Complete                   ║')
  console.log('╚════════════════════════════════════════╝')
  console.log('\nNote: SQL migration (006_correlations.sql) must be')
  console.log('run manually in Supabase SQL Editor if not done yet.')
}

main().catch(console.error)
