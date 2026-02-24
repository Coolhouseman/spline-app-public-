import React, { ReactElement, useEffect, useState, useCallback, useRef } from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase';
import { resolveBackendOrigin } from '@/utils/backend';

const STRIPE_KEY_CACHE_KEY = '@spline_stripe_publishable_key';
const STRIPE_TEST_MODE_CACHE_KEY = '@spline_stripe_test_mode';
const STRIPE_FETCH_TIMEOUT_MS = 7000;
const FALLBACK_BACKEND_URL = 'https://www.spline.nz';

let stripeProviderReady = false;
export const isStripeProviderReady = () => stripeProviderReady;
const resolveBackendOriginSafe = () => {
  try {
    return resolveBackendOrigin();
  } catch (resolveError) {
    console.warn('[StripeWrapper] Failed to resolve backend origin, using fallback:', resolveError);
    return FALLBACK_BACKEND_URL;
  }
};

interface StripeWrapperProps {
  children: ReactElement;
}

export function StripeWrapper({ children }: StripeWrapperProps) {
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [testMode, setTestMode] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isBootstrapped, setIsBootstrapped] = useState(false);
  const authStateRef = useRef<boolean | null>(null);
  const backendOriginRef = useRef<string>(resolveBackendOriginSafe());

  const withTimeout = useCallback(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), STRIPE_FETCH_TIMEOUT_MS);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }, []);

  const cacheKey = useCallback(async (key: string, mode: boolean) => {
    try {
      await AsyncStorage.multiSet([
        [STRIPE_KEY_CACHE_KEY, key],
        [STRIPE_TEST_MODE_CACHE_KEY, mode ? '1' : '0'],
      ]);
    } catch (cacheError) {
      console.warn('[StripeWrapper] Failed to cache publishable key:', cacheError);
    }
  }, []);

  const hydrateCachedKey = useCallback(async () => {
    try {
      const cached = await AsyncStorage.multiGet([STRIPE_KEY_CACHE_KEY, STRIPE_TEST_MODE_CACHE_KEY]);
      const cachedKey = cached.find(([k]) => k === STRIPE_KEY_CACHE_KEY)?.[1];
      const cachedMode = cached.find(([k]) => k === STRIPE_TEST_MODE_CACHE_KEY)?.[1];
      if (cachedKey) {
        setPublishableKey(cachedKey);
        setTestMode(cachedMode === '1');
        setError(null);
        console.log('[StripeWrapper] Loaded cached Stripe publishable key');
      }
    } catch (cacheError) {
      console.warn('[StripeWrapper] Failed to load cached key:', cacheError);
    }
  }, []);

  const fetchUserSpecificKey = useCallback(async () => {
    const startedAt = Date.now();
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (accessToken) {
        const response = await withTimeout(`${backendOriginRef.current}/api/stripe/user-publishable-key`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.publishableKey) {
            setPublishableKey(data.publishableKey);
            setTestMode(data.testMode || false);
            setError(null);
            await cacheKey(data.publishableKey, Boolean(data.testMode));
            console.log('[StripeWrapper] User-specific Stripe key loaded in', Date.now() - startedAt, 'ms');
            return;
          }
        }
      }
      
      const response = await withTimeout(`${backendOriginRef.current}/api/stripe/publishable-key`);
      if (response.ok) {
        const data = await response.json();
        if (data.publishableKey) {
          setPublishableKey(data.publishableKey);
          const mode = Boolean(data.testMode);
          setTestMode(mode);
          setError(null);
          await cacheKey(data.publishableKey, mode);
          console.log('[StripeWrapper] Public Stripe key loaded in', Date.now() - startedAt, 'ms');
        } else {
          setError('Invalid key response');
        }
      } else {
        setError('Failed to fetch payment configuration');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setError('Stripe key fetch timed out');
        console.warn('[StripeWrapper] Stripe key fetch timed out after', STRIPE_FETCH_TIMEOUT_MS, 'ms');
      } else {
        console.error('Error fetching Stripe publishable key:', err);
        setError('Network error fetching payment configuration');
      }
      // Non-blocking startup: app remains usable, only payment flows may be unavailable.
      console.warn('[StripeWrapper] Continuing without fresh Stripe key');
    }
  }, [cacheKey, withTimeout]);

  useEffect(() => {
    console.log('[StripeWrapper] Bootstrapping with backend:', backendOriginRef.current);
    let mounted = true;
    void hydrateCachedKey()
      .finally(() => {
        if (mounted) {
          setIsBootstrapped(true);
        }
      });
    void fetchUserSpecificKey();
    
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      const wasAuthenticated = authStateRef.current;
      const nowAuthenticated = !!session;
      authStateRef.current = nowAuthenticated;
      
      if (wasAuthenticated !== nowAuthenticated || event === 'SIGNED_IN') {
        void fetchUserSpecificKey();
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [fetchUserSpecificKey, hydrateCachedKey]);

  useEffect(() => {
    stripeProviderReady = Boolean(publishableKey);
  }, [publishableKey]);

  if (!isBootstrapped) {
    // Never block app shell while Stripe initializes.
    return children;
  }

  if (!publishableKey) {
    return children;
  }

  return (
    <StripeProvider
      key={`stripe-${testMode ? 'test' : 'live'}`}
      publishableKey={publishableKey}
      merchantIdentifier="merchant.com.splinepay.app"
    >
      {children}
    </StripeProvider>
  );
}
