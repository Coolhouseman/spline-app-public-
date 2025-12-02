import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Direct Supabase URL for admin client
const supabaseUrl = 'https://vhicohutiocnfjwsofhy.supabase.co';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let adminClient: SupabaseClient;

if (supabaseServiceRoleKey && supabaseServiceRoleKey.length > 0) {
  adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
} else {
  console.warn('SUPABASE_SERVICE_ROLE_KEY not available, using regular client for admin operations');
  adminClient = supabase;
}

export const supabaseAdmin = adminClient;
