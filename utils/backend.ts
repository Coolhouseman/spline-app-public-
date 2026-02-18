import * as Constants from 'expo-constants';

/**
 * Resolves the backend API origin for BlinkPay operations.
 * 
 * Environment support:
 * - Production/staging: Uses EXPO_PUBLIC_BACKEND_URL or app config `extra.backendUrl`
 * - Expo Go on LAN: Auto-detects from hostUri (HTTP)
 * - Expo Go tunnel (exp.host/u.expo.dev): Requires EXPO_PUBLIC_BACKEND_URL
 * - Localhost web: Falls back to http://localhost:8082
 * 
 * Note: Expo tunnel mode cannot reach local backends.
 * Set EXPO_PUBLIC_BACKEND_URL to your deployed backend URL for tunnel testing.
 */
const APP_CONFIG_BACKEND_URL =
  (Constants.default.expoConfig?.extra as { backendUrl?: string } | undefined)?.backendUrl;
const PRODUCTION_BACKEND_URL = APP_CONFIG_BACKEND_URL || 'https://www.spline.nz';

export const resolveBackendOrigin = (): string => {
  const isDev = __DEV__;

  // In production builds (TestFlight, App Store), always honor app config backend
  // to avoid stale CI/local EXPO_PUBLIC_BACKEND_URL values pointing to old hosts.
  if (!isDev) {
    console.log('Using production backend URL:', PRODUCTION_BACKEND_URL);
    return PRODUCTION_BACKEND_URL;
  }

  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    const url = process.env.EXPO_PUBLIC_BACKEND_URL;
    console.log('Using EXPO_PUBLIC_BACKEND_URL (dev):', url);
    return url;
  }

  if (APP_CONFIG_BACKEND_URL) {
    console.log('Using app config backendUrl:', APP_CONFIG_BACKEND_URL);
    return APP_CONFIG_BACKEND_URL;
  }
  
  if (Constants.default.expoConfig?.hostUri) {
    const fullHostUri = Constants.default.expoConfig.hostUri;
    const hostWithoutScheme = fullHostUri.replace(/^[a-z]+:\/\//, '');
    const hostWithoutPath = hostWithoutScheme.split('/')[0];
    const host = hostWithoutPath.split(':')[0];
    
    if (host === 'exp.host' || host === 'u.expo.dev') {
      console.error(
        '⚠️ EXPO TUNNEL DETECTED: Backend cannot be reached through Expo tunnel.',
        '\nPlease set EXPO_PUBLIC_BACKEND_URL environment variable to your Vercel backend URL.',
        '\nOr use LAN mode instead of tunnel mode for local testing.'
      );
      throw new Error(
        'Backend unreachable in Expo tunnel mode. Set EXPO_PUBLIC_BACKEND_URL or use LAN mode.'
      );
    }
    
    const url = `http://${host}:8082`;
    console.log('Using hostUri with scheme:', url, 'from', fullHostUri);
    return url;
  }
  
  const fallback = 'http://localhost:8082';
  console.log('Using fallback localhost:', fallback);
  return fallback;
};
