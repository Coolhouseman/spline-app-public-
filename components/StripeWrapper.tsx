import React, { ReactElement } from 'react';
import { Platform } from 'react-native';

interface StripeWrapperProps {
  children: ReactElement;
}

let NativeStripeWrapper: React.ComponentType<StripeWrapperProps> | null = null;

if (Platform.OS !== 'web') {
  NativeStripeWrapper = require('./StripeWrapper.native').StripeWrapper;
}

export function StripeWrapper({ children }: StripeWrapperProps) {
  if (Platform.OS === 'web' || !NativeStripeWrapper) {
    return <>{children}</>;
  }
  
  return <NativeStripeWrapper>{children}</NativeStripeWrapper>;
}
