// Load IP-to-country ranges into ip_geo_ranges (migration 097).
//
// Source: DB-IP IP to Country Lite, published monthly under CC BY 4.0, which
// permits commercial use with attribution. No account or key is needed.
//   https://db-ip.com/db/download/ip-to-country-lite
//
// Run monthly:  node scripts/load-ip-geo.mjs
//               node scripts/load-ip-geo.mjs --ipv6     (when Vigil holds IPv6)
//               node scripts/load-ip-geo.mjs --file path/to/dbip.csv
//
// This is a script rather than a worker feed on purpose: parsing 357k rows costs
// far more than the 10ms of CPU a free-plan Cron Trigger gets, and the data only
// changes once a month.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import readline from 'node:readline'
import { supabaseUrl, supabaseKey } from './env.mjs'

const CHUNK = 5000
const SOURCE = 'db-ip-lite'

function monthlyUrl(date = new Date()) {
  const stamp = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
  return `https://download.db-ip.com/free/dbip-country-lite-${stamp}.csv.gz`
}

async function download(url, target) {
  process.stdout.write(`Fetching ${url}\n`)
  const res = await fetch(url, { headers: { 'User-Agent': 'Vigil-ThreatIntel/1.0' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  const gz = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(target, zlib.gunzipSync(gz))
  return target
}

async function post(rows) {
  const res = await fetch(`${supabaseUrl}/rest/v1/ip_geo_ranges`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`insert failed: ${res.status} ${(await res.text()).slice(0, 300)}`)
}

async function main() {
  const wantIpv6 = process.argv.includes('--ipv6')
  const fileArg = process.argv.indexOf('--file')
  const csvPath =
    fileArg > -1
      ? process.argv[fileArg + 1]
      : await download(monthlyUrl(), path.join(os.tmpdir(), 'dbip-country-lite.csv'))

  const reader = readline.createInterface({
    input: fs.createReadStream(csvPath),
    crlfDelay: Infinity,
  })

  let batch = []
  let loaded = 0
  let skipped = 0

  for await (const line of reader) {
    const [start, end, country] = line.split(',')
    if (!start || !end || !country) continue

    // Vigil holds no IPv6 indicators, so those ranges are dead weight by default.
    const isIpv6 = start.includes(':')
    if (isIpv6 && !wantIpv6) {
      skipped++
      continue
    }

    batch.push({ start_ip: start, end_ip: end, country_code: country.trim(), source: SOURCE })

    if (batch.length >= CHUNK) {
      await post(batch)
      loaded += batch.length
      batch = []
      process.stdout.write(`\r  loaded ${loaded.toLocaleString()} ranges`)
    }
  }

  if (batch.length) {
    await post(batch)
    loaded += batch.length
  }

  process.stdout.write(`\r  loaded ${loaded.toLocaleString()} ranges\n`)
  console.log(`Skipped ${skipped.toLocaleString()} IPv6 ranges (pass --ipv6 to include them)`)
  console.log('Attribution required by CC BY 4.0: "IP Geolocation by DB-IP" (https://db-ip.com)')
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
