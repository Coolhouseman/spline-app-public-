import { supabase } from './supabase';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const getServerUrl = () => {
  // For web, use localhost
  if (Platform.OS === 'web') {
    return 'http://localhost:8082';
  }
  
  // For mobile in development, try multiple sources for the backend URL
  if (__DEV__) {
    // First, try the EXPO_PUBLIC_BACKEND_URL environment variable
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
    if (backendUrl) {
      // Extract just the domain (remove port if present)
      const url = new URL(backendUrl);
      return `https://${url.hostname}`;
    }
    
    // Second, try hostUri from Metro bundler (for local development)
    if (Constants.expoConfig?.hostUri) {
      const host = Constants.expoConfig.hostUri.split(':')[0];
      // Use HTTPS for Replit domains
      if (host.includes('replit')) {
        return `https://${host}`;
      }
      return `http://${host}:8082`;
    }
  }
  
  // Production fallback
  return 'https://splinepay.replit.app';
};

const SERVER_URL = getServerUrl();

interface CardDetails {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

interface StripeCustomerResponse {
  customerId: string;
}

interface SetupIntentResponse {
  clientSecret: string;
  setupIntentId: string;
}

interface ConfirmSetupResponse {
  paymentMethodId: string;
  card: CardDetails;
}

interface ChargeResponse {
  success: boolean;
  paymentIntentId: string;
  status: string;
}

export class StripeService {
  static async createCustomer(
    userId: string, 
    email: string, 
    name: string
  ): Promise<string> {
    const response = await fetch(`${SERVER_URL}/api/stripe/create-customer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, email, name }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create Stripe customer');
    }

    const data: StripeCustomerResponse = await response.json();
    return data.customerId;
  }

  static async createSetupIntent(customerId: string): Promise<SetupIntentResponse> {
    const response = await fetch(`${SERVER_URL}/api/stripe/create-setup-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create SetupIntent');
    }

    return response.json();
  }

  static async confirmSetup(setupIntentId: string): Promise<ConfirmSetupResponse> {
    const response = await fetch(`${SERVER_URL}/api/stripe/confirm-setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setupIntentId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to confirm card setup');
    }

    return response.json();
  }

  static async chargeCard(
    customerId: string,
    paymentMethodId: string,
    amount: number,
    description: string,
    metadata?: Record<string, string>
  ): Promise<ChargeResponse> {
    const response = await fetch(`${SERVER_URL}/api/stripe/charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId,
        paymentMethodId,
        amount,
        description,
        metadata,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Payment failed');
    }

    return response.json();
  }

  static async getOrCreateCustomer(
    userId: string,
    email: string,
    name: string
  ): Promise<string> {
    const { data: wallet } = await supabase
      .from('wallets')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (wallet?.stripe_customer_id) {
      return wallet.stripe_customer_id;
    }

    const customerId = await this.createCustomer(userId, email, name);

    await supabase
      .from('wallets')
      .update({ stripe_customer_id: customerId })
      .eq('user_id', userId);

    return customerId;
  }

  static async savePaymentMethod(
    userId: string,
    paymentMethodId: string,
    cardBrand: string,
    cardLast4: string
  ): Promise<void> {
    const { error } = await supabase
      .from('wallets')
      .update({
        stripe_payment_method_id: paymentMethodId,
        card_brand: cardBrand,
        card_last4: cardLast4,
        bank_connected: true,
      })
      .eq('user_id', userId);

    if (error) {
      throw new Error('Failed to save payment method');
    }
  }

  static async removePaymentMethod(userId: string): Promise<void> {
    const { data: wallet } = await supabase
      .from('wallets')
      .select('stripe_payment_method_id')
      .eq('user_id', userId)
      .single();

    if (wallet?.stripe_payment_method_id) {
      try {
        await fetch(`${SERVER_URL}/api/stripe/payment-method/${wallet.stripe_payment_method_id}`, {
          method: 'DELETE',
        });
      } catch (error) {
        console.error('Error removing payment method from Stripe:', error);
      }
    }

    await supabase
      .from('wallets')
      .update({
        stripe_payment_method_id: null,
        card_brand: null,
        card_last4: null,
        bank_connected: false,
      })
      .eq('user_id', userId);
  }

  static async hasPaymentMethod(userId: string): Promise<boolean> {
    const { data: wallet } = await supabase
      .from('wallets')
      .select('stripe_payment_method_id')
      .eq('user_id', userId)
      .single();

    return !!wallet?.stripe_payment_method_id;
  }

  static async getPaymentMethodDetails(userId: string): Promise<{
    brand: string;
    last4: string;
  } | null> {
    const { data: wallet } = await supabase
      .from('wallets')
      .select('card_brand, card_last4')
      .eq('user_id', userId)
      .single();

    if (!wallet?.card_brand || !wallet?.card_last4) {
      return null;
    }

    return {
      brand: wallet.card_brand,
      last4: wallet.card_last4,
    };
  }

  static async initiateCardSetup(
    userId: string,
    email: string,
    name: string,
    existingCustomerId?: string
  ): Promise<{ customerId: string; setupIntentId: string; cardSetupUrl: string }> {
    console.log('Initiating card setup with SERVER_URL:', SERVER_URL);
    
    const response = await fetch(`${SERVER_URL}/api/stripe/initiate-card-setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId, 
        email, 
        name,
        customerId: existingCustomerId 
      }),
    });

    // Check content type to ensure we got JSON, not HTML
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Server returned non-JSON response:', contentType);
      throw new Error('Server connection error. Please try again.');
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to initiate card setup');
    }

    return response.json();
  }

  static async completeCardSetup(
    userId: string,
    setupIntentId: string,
    paymentMethodId: string,
    customerId: string
  ): Promise<void> {
    const response = await fetch(`${SERVER_URL}/api/stripe/confirm-setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setupIntentId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to confirm card setup');
    }

    const { card } = await response.json();

    await supabase
      .from('wallets')
      .update({
        stripe_customer_id: customerId,
        stripe_payment_method_id: paymentMethodId,
        card_brand: card.brand,
        card_last4: card.last4,
        bank_connected: true,
      })
      .eq('user_id', userId);
  }
}
