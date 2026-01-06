import React from 'react';

interface StripeWrapperProps {
  children: React.ReactNode;
}

export function StripeWrapper({ children }: StripeWrapperProps) {
  return <>{children}</>;
}
