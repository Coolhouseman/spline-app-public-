import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Direct Supabase configuration - works on all platforms (web, iOS, Android)
const supabaseUrl = 'https://vhicohutiocnfjwsofhy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoaWNvaHV0aW9jbmZqd3NvZmh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzOTcwNTgsImV4cCI6MjA2Mzk3MzA1OH0.EI2qBBfKIoF5HZIFU_Ls62xi5A0EPKwylvKGl9ppwQA';

// Debug: Log to verify correct credentials are loaded
console.log('Supabase config - Platform:', Platform.OS, 'URL:', supabaseUrl, 'Key first 20 chars:', supabaseAnonKey.substring(0, 20));

// Clear any corrupted sessions on startup (temporary fix)
if (Platform.OS !== 'web') {
  AsyncStorage.removeItem('sb-vhicohutiocnfjwsofhy-auth-token').catch(() => {});
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
