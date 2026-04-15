import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if(!supabaseUrl) {
  console.log("No url found");
  process.exit(1);
}

const s = createClient(supabaseUrl, supabaseKey);
s.rpc('exec_sql', { sql: 'ALTER TABLE settings ALTER COLUMN invoice_counter TYPE bigint;' })
  .then(res => console.log('Fixed invoice_counter type:', res))
  .catch(console.error);
