import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addColumn() {
  // Try to add the column using Supabase RPC or direct query
  // First, let's check if the column exists by selecting from wallets
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .limit(1);

  console.log('Current wallet structure:');
  if (data && data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
  } else if (error) {
    console.log('Error:', error);
  } else {
    console.log('No data found');
  }
}

addColumn();
