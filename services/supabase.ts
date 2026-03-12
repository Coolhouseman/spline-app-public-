import { AppState, Platform } from 'react-native';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vhicohutiocnfjwsofhy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoaWNvaHV0aW9jbmZqd3NvZmh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NTQ2NjksImV4cCI6MjA3OTUzMDY2OX0.KJuLMgwy2Dfu5amY0VN4KfPemfsJcRB3EI0AxZQpOb8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    ...(Platform.OS !== 'web'
      ? { storage: AsyncStorage }
      : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

let autoRefreshListenerRegistered = false;

/**
 * Call once after initial session restore to start the foreground/background
 * auto-refresh cycle. Deferring this avoids lock contention with the very
 * first getSession() call on cold start.
 */
export function activateAutoRefresh() {
  if (Platform.OS === 'web' || autoRefreshListenerRegistered) return;
  autoRefreshListenerRegistered = true;

  if (AppState.currentState === 'active') {
    void supabase.auth.startAutoRefresh();
  }

  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}
