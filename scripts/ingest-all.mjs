// Master Ingestion Script
// Runs all data source ingestions in sequence
// Run: node scripts/ingest-all.mjs

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const scripts = [
  { name: 'CISA KEV', file: 'ingest-cisa-kev.mjs' },
  { name: 'NVD CVEs', file: 'ingest-nvd.mjs' },
  { name: 'ThreatFox IOCs', file: 'ingest-threatfox.mjs' },
  { name: 'URLhaus', file: 'ingest-urlhaus.mjs' },
  { name: 'Feodo Tracker', file: 'ingest-feodo.mjs' },
]

function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [scriptPath], {
      cwd: path.dirname(scriptPath),
      stdio: 'inherit',
      env: process.env
    })

    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Script exited with code ${code}`))
      }
    })

    proc.on('error', reject)
  })
}

async function runAll() {
  console.log('=' .repeat(60))
  console.log('VIGIL - Threat Intelligence Data Ingestion')
  console.log('=' .repeat(60))
  console.log(`Started at: ${new Date().toISOString()}`)
  console.log('')

  const results = []

  for (const script of scripts) {
    console.log('-'.repeat(60))
    console.log(`Running: ${script.name}`)
    console.log('-'.repeat(60))

    const start = Date.now()
    try {
      await runScript(path.join(__dirname, script.file))
      const duration = ((Date.now() - start) / 1000).toFixed(1)
      results.push({ name: script.name, status: 'success', duration })
      console.log(`\n[OK] ${script.name} completed in ${duration}s\n`)
    } catch (e) {
      const duration = ((Date.now() - start) / 1000).toFixed(1)
      results.push({ name: script.name, status: 'failed', duration, error: e.message })
      console.log(`\n[FAILED] ${script.name}: ${e.message}\n`)
    }

    // Small delay between scripts to avoid rate limiting
    await new Promise(r => setTimeout(r, 2000))
  }

  console.log('='.repeat(60))
  console.log('INGESTION SUMMARY')
  console.log('='.repeat(60))

  for (const r of results) {
    const status = r.status === 'success' ? '[OK]' : '[FAIL]'
    console.log(`${status} ${r.name} (${r.duration}s)`)
  }

  const successful = results.filter(r => r.status === 'success').length
  console.log('')
  console.log(`Completed: ${successful}/${scripts.length} sources`)
  console.log(`Finished at: ${new Date().toISOString()}`)
}

runAll().catch(console.error)
