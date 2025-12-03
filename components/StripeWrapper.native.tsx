import React, { ReactElement, useEffect, useState, useCallback } from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';
import { Platform, View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { supabase } from '@/services/supabase';

const getServerUrl = () => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.origin) {
      const origin = window.location.origin;
      if (origin.includes('replit') || origin.includes('localhost')) {
        return origin;
      }
    }
    return 'http://localhost:8082';
  }
  return 'https://splinepay.replit.app';
};

interface StripeWrapperProps {
  children: ReactElement;
}

export function StripeWrapper({ children }: StripeWrapperProps) {
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [testMode, setTestMode] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const fetchUserSpecificKey = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      
      if (accessToken) {
        const response = await fetch(`${getServerUrl()}/api/stripe/user-publishable-key`, {
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
            return;
          }
        }
      }
      
      const response = await fetch(`${getServerUrl()}/api/stripe/publishable-key`);
      if (response.ok) {
        const data = await response.json();
        if (data.publishableKey) {
          setPublishableKey(data.publishableKey);
          setTestMode(false);
          setError(null);
        } else {
          setError('Invalid key response');
        }
      } else {
        setError('Failed to fetch payment configuration');
      }
    } catch (err) {
      console.error('Error fetching Stripe publishable key:', err);
      setError('Network error fetching payment configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserSpecificKey();
    
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      const wasAuthenticated = isAuthenticated;
      const nowAuthenticated = !!session;
      setIsAuthenticated(nowAuthenticated);
      
      if (wasAuthenticated !== nowAuthenticated || event === 'SIGNED_IN') {
        setLoading(true);
        fetchUserSpecificKey();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [fetchUserSpecificKey, isAuthenticated]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (error || !publishableKey) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Payment Setup Error</Text>
        <Text style={styles.errorText}>
          {error || 'Unable to initialize payment system. Please try again later.'}
        </Text>
      </View>
    );
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

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#DC2626',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});
