import { supabase } from './supabase';
import type { Wallet, Transaction } from '@/shared/types';

export interface BankDetails {
  bank_name: string;
  account_last4: string;
  account_type: string;
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
    const { data, error } = await supabase
      .from('wallets')
      .update({
        bank_connected: false,
        bank_details: null,
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
      .select('balance, bank_connected')
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
