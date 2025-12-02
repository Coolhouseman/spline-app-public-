import React, { ReactElement } from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || 
  Constants.expoConfig?.extra?.stripePublishableKey || 
  'pk_test_51RTOqR2RDv5hPCMGNjhH8X9aQzQ8MRHwT2Xq4dXZ1YCxhP1nGxX8mJpYqR3sT5dB6fK7vL8wN9jM0kO1pQ2rS3tU4';

interface StripeWrapperProps {
  children: ReactElement;
}

export function StripeWrapper({ children }: StripeWrapperProps) {
  return (
    <StripeProvider
      publishableKey={STRIPE_PUBLISHABLE_KEY}
      merchantIdentifier="merchant.com.splinepay.app"
    >
      {children}
    </StripeProvider>
  );
}
