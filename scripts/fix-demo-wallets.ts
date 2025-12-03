import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

async function createWallets() {
  const userIds = [
    { id: '405b7c92-0f06-4694-a02c-3ae228ba6c16', email: 'account1@gmail.com' },
    { id: 'e0e7bef3-6ae8-4c7a-b430-4d4a7c04e758', email: 'account2@gmail.com' }
  ];

  for (const user of userIds) {
    console.log(`Creating wallet for ${user.email}...`);
    
    const { error } = await supabase
      .from('wallets')
      .insert({
        user_id: user.id,
        balance: 100,
        bank_connected: false,
        stripe_test_mode: true
      });

    if (error) {
      console.error(`Error creating wallet for ${user.email}:`, error);
    } else {
      console.log(`Wallet created for ${user.email} with $100 balance and test mode enabled`);
    }
  }

  // Make them friends with each other
  console.log('\nMaking demo accounts friends...');
  
  const { error: friendError } = await supabase
    .from('friends')
    .insert({
      user_id: '405b7c92-0f06-4694-a02c-3ae228ba6c16',
      friend_id: 'e0e7bef3-6ae8-4c7a-b430-4d4a7c04e758',
      status: 'accepted'
    });

  if (friendError && !friendError.message.includes('duplicate')) {
    console.error('Error creating friendship:', friendError);
  } else {
    console.log('Demo accounts are now friends!');
  }
  
  // Create reverse friendship
  const { error: reverseError } = await supabase
    .from('friends')
    .insert({
      user_id: 'e0e7bef3-6ae8-4c7a-b430-4d4a7c04e758',
      friend_id: '405b7c92-0f06-4694-a02c-3ae228ba6c16',
      status: 'accepted'
    });

  if (reverseError && !reverseError.message.includes('duplicate')) {
    console.error('Error creating reverse friendship:', reverseError);
  }

  console.log('\nDone! Demo accounts are ready for Apple review.');
}

createWallets();
