import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function check() {
  // Check auth users
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  
  const demoUsers = users?.filter(u => 
    u.email === 'account1@gmail.com' || u.email === 'account2@gmail.com'
  );
  
  console.log('Demo users in auth:');
  demoUsers?.forEach(u => {
    console.log(`  ${u.email} - ID: ${u.id}`);
  });

  // Check profile users
  console.log('\nDemo users in users table:');
  const { data: profiles } = await supabase
    .from('users')
    .select('id, email, unique_id, name')
    .in('email', ['account1@gmail.com', 'account2@gmail.com']);
  
  console.log(profiles);

  // Check wallets
  if (profiles && profiles.length > 0) {
    console.log('\nWallets:');
    const { data: wallets } = await supabase
      .from('wallets')
      .select('user_id, balance, stripe_test_mode')
      .in('user_id', profiles.map(p => p.id));
    
    console.log(wallets);
  }
}

check();
