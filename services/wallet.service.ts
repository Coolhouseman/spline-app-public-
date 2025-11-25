import { supabase } from './supabase';
import type { Wallet, Transaction } from '@/shared/types';

const BACKEND_URL = 'http://localhost:3000';

export interface BankDetails {
  bank_name: string;
  account_last4: string;
  account_type: string;
}

export interface BlinkPayConsentResponse {
  consentId: string;
  redirectUri: string;
}

interface BlinkPayBankDetails {
  consent_id: string;
  bank_name: string;
  account_reference: string;
  status: string;
  expires_at: string;
}

export class WalletService {
  static async getWallet(userId: string): Promise<Wallet> {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data as Wallet;
  }

  static async initiateBlinkPayConsent(
    userId: string, 
    redirectUri: string
  ): Promise<BlinkPayConsentResponse> {
    const response = await fetch(`${BACKEND_URL}/api/blinkpay/consent/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ redirectUri }),
    });

    if (!response.ok) {
      throw new Error('Failed to create BlinkPay consent');
    }

    const result = await response.json();
    
    await supabase
      .from('wallets')
      .update({
        blinkpay_consent_id: result.consentId,
        blinkpay_consent_status: 'pending'
      })
      .eq('user_id', userId);

    return result;
  }

  static async completeBlinkPayConsent(userId: string): Promise<Wallet> {
    const { data: wallet } = await supabase
      .from('wallets')
      .select('blinkpay_consent_id')
      .eq('user_id', userId)
      .single();

    if (!wallet?.blinkpay_consent_id) {
      throw new Error('No BlinkPay consent found');
    }

    const response = await fetch(`${BACKEND_URL}/api/blinkpay/consent/${wallet.blinkpay_consent_id}`);
    
    if (!response.ok) {
      throw new Error('Failed to get BlinkPay consent details');
    }

    const bankDetails: BlinkPayBankDetails = await response.json();

    const { data, error } = await supabase
      .from('wallets')
      .update({
        bank_connected: true,
        bank_details: {
          bank_name: bankDetails.bank_name,
          account_last4: bankDetails.account_reference,
          account_type: 'BlinkPay'
        },
        blinkpay_consent_status: bankDetails.status,
        blinkpay_consent_expires_at: bankDetails.expires_at
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data as Wallet;
  }

  static async connectBank(userId: string, bankDetails: BankDetails): Promise<Wallet> {
    const { data, error } = await supabase
      .from('wallets')
      .update({
        bank_connected: true,
        bank_details: bankDetails,
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data as Wallet;
  }

  static async updateBank(userId: string, bankDetails: BankDetails): Promise<Wallet> {
    const { data, error } = await supabase
      .from('wallets')
      .update({
        bank_details: bankDetails,
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data as Wallet;
  }

  static async disconnectBank(userId: string): Promise<Wallet> {
    const { data: wallet } = await supabase
      .from('wallets')
      .select('blinkpay_consent_id')
      .eq('user_id', userId)
      .single();

    if (wallet?.blinkpay_consent_id) {
      try {
        await fetch(`${BACKEND_URL}/api/blinkpay/consent/revoke`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ consentId: wallet.blinkpay_consent_id }),
        });
      } catch (error) {
        console.error('Failed to revoke BlinkPay consent:', error);
      }
    }

    const { data, error } = await supabase
      .from('wallets')
      .update({
        bank_connected: false,
        bank_details: null,
        blinkpay_consent_id: null,
        blinkpay_consent_status: null,
        blinkpay_consent_expires_at: null
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data as Wallet;
  }

  static async addFunds(userId: string, amount: number): Promise<Transaction> {
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (walletError) throw walletError;

    const newBalance = parseFloat(wallet.balance.toString()) + amount;

    const { error: updateError } = await supabase
      .from('wallets')
      .update({ balance: newBalance })
      .eq('user_id', userId);

    if (updateError) throw updateError;

    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'deposit',
        amount: amount,
        description: 'Added funds to wallet',
        direction: 'in',
      })
      .select()
      .single();

    if (transactionError) throw transactionError;
    return transaction as Transaction;
  }

  static async withdraw(userId: string, amount: number): Promise<Transaction> {
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance, bank_connected, blinkpay_consent_id')
      .eq('user_id', userId)
      .single();

    if (walletError) throw walletError;
    if (!wallet.bank_connected) {
      throw new Error('Bank account must be connected to withdraw funds');
    }

    const currentBalance = parseFloat(wallet.balance.toString());
    if (currentBalance < amount) {
      throw new Error('Insufficient balance');
    }

    if (wallet.blinkpay_consent_id) {
      throw new Error('Withdrawals via BlinkPay are not supported. Funds remain in your Split wallet for paying friends.');
    }

    const newBalance = currentBalance - amount;

    const { error: updateError } = await supabase
      .from('wallets')
      .update({ balance: newBalance })
      .eq('user_id', userId);

    if (updateError) throw updateError;

    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'withdrawal',
        amount: amount,
        description: 'Withdrew funds from wallet',
        direction: 'out',
      })
      .select()
      .single();

    if (transactionError) throw transactionError;
    return transaction as Transaction;
  }

  static async getTransactions(userId: string): Promise<Transaction[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Transaction[];
  }
}
