import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

function generateUniqueId(): string {
  const min = 10000;
  const max = 9999999999;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

async function createDemoAccount(email: string, password: string, name: string) {
  console.log(`Creating demo account for ${email}...`);

  const { data: existingUsers } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (existingUsers) {
    console.log(`User ${email} already exists, updating stripe_test_mode...`);
    
    const { error: walletError } = await supabase
      .from('wallets')
      .update({ 
        stripe_test_mode: true,
        balance: 100
      })
      .eq('user_id', existingUsers.id);
    
    if (walletError) {
      console.error('Error updating wallet:', walletError);
    } else {
      console.log(`Updated wallet for ${email} with test mode enabled and $100 balance`);
    }
    return;
  }

  const { data: { users: authUsers }, error: listError } = await supabase.auth.admin.listUsers();
  const existingAuthUser = authUsers?.find(u => u.email === email);
  
  let userId: string;
  
  if (existingAuthUser) {
    console.log(`Auth user exists for ${email}, creating profile...`);
    userId = existingAuthUser.id;
  } else {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
      }
    });

    if (authError) {
      console.error('Auth error:', authError);
      return;
    }

    if (!authData.user) {
      console.error('No user created');
      return;
    }
    
    userId = authData.user.id;
  }
  const uniqueId = generateUniqueId();

  const { error: profileError } = await supabase
    .from('users')
    .insert({
      id: userId,
      unique_id: uniqueId,
      name,
      email,
      phone: '+64211234567',
      date_of_birth: '1990-01-01',
      bio: 'Apple Review Demo Account',
    });

  if (profileError) {
    console.error('Profile error:', profileError);
    return;
  }

  const { error: walletError } = await supabase
    .from('wallets')
    .insert({
      user_id: userId,
      balance: 100,
      bank_connected: false,
      stripe_test_mode: true,
    });

  if (walletError) {
    console.error('Wallet error:', walletError);
    return;
  }

  console.log(`Created demo account for ${email}`);
  console.log(`  User ID: ${userId}`);
  console.log(`  Unique ID: ${uniqueId}`);
  console.log(`  Stripe Test Mode: ENABLED`);
  console.log(`  Starting Balance: $100`);
}

async function main() {
  console.log('Creating Apple Reviewer Demo Accounts...\n');

  await createDemoAccount('account1@gmail.com', 'account2213', 'Demo Account One');
  console.log('');
  await createDemoAccount('account2@gmail.com', 'account2213', 'Demo Account Two');

  console.log('\n=== Demo Accounts Ready ===');
  console.log('These accounts use Stripe TEST mode.');
  console.log('Reviewers can use test card: 4242 4242 4242 4242');
  console.log('Expiry: Any future date, CVC: Any 3 digits');
}

main().catch(console.error);
