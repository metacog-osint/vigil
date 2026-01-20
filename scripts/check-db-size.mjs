import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const tables = [
  'incidents', 'threat_actors', 'iocs', 'vulnerabilities', 'cyber_events',
  'actor_techniques', 'actor_cves', 'malware_samples', 'sync_log', 'advisories'
];

let totalEstimate = 0;
console.log('Table row counts and size estimates:\n');

for (const table of tables) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (!error && count) {
    // Estimate: IOCs ~200 bytes, incidents ~800 bytes, others ~400 bytes average
    const bytesPerRow = table === 'iocs' ? 200 : table === 'incidents' ? 800 : 400;
    const estimate = count * bytesPerRow;
    totalEstimate += estimate;
    console.log(`${table.padEnd(20)} ${String(count).padStart(8)} rows  ~${(estimate / 1024 / 1024).toFixed(1).padStart(6)} MB`);
  } else if (error) {
    console.log(`${table.padEnd(20)} (error: ${error.message})`);
  }
}

console.log('\n' + '='.repeat(50));
console.log(`ESTIMATED TOTAL:     ${(totalEstimate / 1024 / 1024).toFixed(0)} MB`);
console.log(`FREE TIER LIMIT:     500 MB`);
console.log('='.repeat(50));

if (totalEstimate > 500 * 1024 * 1024) {
  console.log('\n⚠️  YOU ARE LIKELY OVER THE FREE TIER LIMIT');
}
