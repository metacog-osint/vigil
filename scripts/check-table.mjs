// Quick check if a table exists
import { createClient } from '@supabase/supabase-js'
import { supabaseUrl, supabaseKey } from './env.mjs'

const supabase = createClient(supabaseUrl, supabaseKey)
const tableName = process.argv[2] || 'malware_samples'

const { data, error } = await supabase.from(tableName).select('id').limit(1)

if (error && error.message.includes('does not exist')) {
  console.log(`TABLE_NOT_EXISTS: ${tableName}`)
  process.exit(1)
} else if (error) {
  console.log(`ERROR: ${error.message}`)
  process.exit(1)
} else {
  console.log(`TABLE_EXISTS: ${tableName} (${data.length} rows returned)`)
  process.exit(0)
}
