import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Access extra config in various Expo environments (Expo Go, dev builds, web)
const getExtraConfig = () => {
  // For development builds and EAS builds
  if (Constants.expoConfig?.extra) {
    return Constants.expoConfig.extra;
  }
  // For Expo Go - manifest2 structure
  if ((Constants as any).manifest2?.extra?.expoClient?.extra) {
    return (Constants as any).manifest2.extra.expoClient.extra;
  }
  // Legacy Expo Go - manifest structure
  if ((Constants as any).manifest?.extra) {
    return (Constants as any).manifest.extra;
  }
  return {};
};

const extraConfig = getExtraConfig();
const supabaseUrl = extraConfig.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = extraConfig.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Please configure environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
