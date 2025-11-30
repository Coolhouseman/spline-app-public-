import { supabase } from './supabase';
import type { Wallet, Transaction } from '@/shared/types';

/**
 * ==========================================================
 * SPLIT WALLET - LEDGER-BASED PAYMENT SYSTEM
 * ==========================================================
 * 
 * BUSINESS MODEL:
 * - All user funds are held in a single business bank account (connected via BlinkPay)
 * - User balances are tracked as ledger entries in the database
 * - In-app transfers between users are just ledger adjustments (no real money movement)
 * - Real money only moves on:
 *   1. DEPOSIT: User's bank → Business holding account (via BlinkPay)
 *   2. WITHDRAWAL: Business holding account → User's bank (requires manual processing)
 * 
 * TRANSACTION TYPES:
 * - deposit: Money added to wallet (from bank via BlinkPay)
 * - withdrawal: Money withdrawn (pending - requires manual processing)
 * - split_payment: User paying their share of a split (ledger deduction)
 * - split_received: User receiving payment from someone (ledger credit)
 * 
 * CRITICAL RULES:
 * - Balance can NEVER go negative
 * - All balance changes MUST be logged in transactions table
 * - Re-fetch balance before any deduction to prevent race conditions
 * ==========================================================
 */

export interface BankDetails {
  bank_name: string;
  account_last4: string;
  account_type: string;
  is_demo?: boolean;
}

export const DEMO_BANKS = [
  { id: 'anz', name: 'ANZ Bank', color: '#007DBA' },
  { id: 'asb', name: 'ASB Bank', color: '#FFCC00' },
  { id: 'bnz', name: 'BNZ', color: '#0033A0' },
  { id: 'westpac', name: 'Westpac', color: '#D5002B' },
  { id: 'kiwibank', name: 'Kiwibank', color: '#00A651' },
];

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
  /**
   * Safely get current balance with fresh data
   * Always call this before any balance-modifying operation
   */
  private static async getCurrentBalance(userId: string): Promise<number> {
    const { data, error } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single();
    
    if (error) throw new Error('Failed to fetch wallet balance');
    return parseFloat(data.balance?.toString() || '0');
  }

  /**
   * Safely update balance with validation
   * Returns the new balance after update
   */
  private static async updateBalance(
    userId: string, 
    newBalance: number,
    operation: string
  ): Promise<number> {
    if (newBalance < 0) {
      throw new Error(`Cannot complete ${operation}: would result in negative balance`);
    }

    const { error } = await supabase
      .from('wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) throw new Error(`Failed to update balance for ${operation}`);
    return newBalance;
  }

  /**
   * Log a transaction - Uses RPC function to bypass schema cache issues
   * MUST be called for every balance change
   */
  private static async logTransaction(
    userId: string,
    type: 'deposit' | 'withdrawal' | 'split_payment' | 'split_received',
    amount: number,
    description: string,
    direction: 'in' | 'out',
    splitEventId?: string,
    metadata?: Record<string, unknown>
  ): Promise<Transaction> {
    // Use RPC function to bypass PostgREST schema cache issues
    const { data: result, error: rpcError } = await supabase.rpc('log_transaction_rpc', {
      p_user_id: userId,
      p_type: type,
      p_amount: amount,
      p_description: description,
      p_direction: direction,
      p_split_event_id: splitEventId || null,
      p_metadata: metadata && Object.keys(metadata).length > 0 ? metadata : null
    });

    if (rpcError) {
      console.error('CRITICAL: Failed to log transaction (RPC):', rpcError);
      throw new Error('Failed to record transaction');
    }

    if (!result.success) {
      console.error('CRITICAL: Transaction logging failed:', result.error);
      throw new Error('Failed to record transaction');
    }

    // Return a transaction object
    return {
      id: result.transaction_id,
      user_id: userId,
      type,
      amount,
      description,
      direction,
      split_event_id: splitEventId || null,
      created_at: new Date().toISOString()
    } as Transaction;
  }
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
    const { data, error } = await supabase.functions.invoke('blinkpay-consent', {
      body: { redirectUri, action: 'create' },
    });

    if (error || !data) {
      console.error('BlinkPay consent error:', error);
      throw new Error('Failed to create BlinkPay consent');
    }

    const result = data;
    
    console.log('Saving consent ID to wallet:', result.consentId);
    
    const { data: existingWallet } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingWallet) {
      const { error: updateError } = await supabase
        .from('wallets')
        .update({
          blinkpay_consent_id: result.consentId,
          blinkpay_consent_status: 'pending'
        })
        .eq('user_id', userId);
      
      if (updateError) {
        console.error('Failed to update wallet with consent ID:', updateError);
        throw new Error('Failed to save consent to wallet');
      }
    } else {
      console.log('No wallet found, creating one for user:', userId);
      const { error: insertError } = await supabase
        .from('wallets')
        .insert({
          user_id: userId,
          balance: 0,
          bank_connected: false,
          blinkpay_consent_id: result.consentId,
          blinkpay_consent_status: 'pending'
        });
      
      if (insertError) {
        console.error('Failed to create wallet with consent ID:', insertError);
        throw new Error('Failed to create wallet');
      }
    }

    console.log('Consent ID saved successfully');
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

    const { data: bankDetails, error: consentError } = await supabase.functions.invoke('blinkpay-consent', {
      body: { consentId: wallet.blinkpay_consent_id, action: 'get' },
    });
    
    if (consentError || !bankDetails) {
      console.error('BlinkPay get consent error:', consentError);
      throw new Error('Failed to get BlinkPay consent details');
    }

    const { data, error: updateError } = await supabase
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

    if (updateError) throw updateError;
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
      .select('blinkpay_consent_id, bank_details')
      .eq('user_id', userId)
      .single();

    if (wallet?.blinkpay_consent_id && !wallet?.bank_details?.is_demo) {
      try {
        await supabase.functions.invoke('blinkpay-consent', {
          body: { consentId: wallet.blinkpay_consent_id, action: 'revoke' },
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

  /**
   * DEMO MODE: Connect a fake bank account for testing
   * This allows testing the full payment flow without BlinkPay
   * All data is saved to the cloud database
   */
  static async connectDemoBank(userId: string, bankId: string): Promise<Wallet> {
    const bank = DEMO_BANKS.find(b => b.id === bankId);
    if (!bank) throw new Error('Invalid demo bank');

    const accountLast4 = Math.floor(1000 + Math.random() * 9000).toString();
    const demoConsentId = `demo_consent_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const { data, error } = await supabase
      .from('wallets')
      .update({
        bank_connected: true,
        bank_details: {
          bank_name: bank.name,
          account_last4: accountLast4,
          account_type: 'Demo Account',
          is_demo: true
        } as BankDetails,
        blinkpay_consent_id: demoConsentId,
        blinkpay_consent_status: 'active',
        blinkpay_consent_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    console.log(`Demo bank connected: ${bank.name} •••• ${accountLast4}`);
    return data as Wallet;
  }

  /**
   * DEMO MODE: Add funds without real BlinkPay charge
   * Simulates a successful bank transfer for testing
   * Uses atomic RPC function to ensure transaction logging and balance update happen together
   */
  static async addFundsDemo(userId: string, amount: number): Promise<Transaction> {
    if (amount <= 0) {
      throw new Error('Deposit amount must be greater than zero');
    }

    const { data: wallet } = await supabase
      .from('wallets')
      .select('bank_connected, bank_details')
      .eq('user_id', userId)
      .single();

    if (!wallet?.bank_connected) {
      throw new Error('Connect a bank account first to add funds');
    }

    console.log(`[DEMO] Processing deposit of $${amount.toFixed(2)} for user ${userId}`);
    
    await new Promise(resolve => setTimeout(resolve, 1500));

    const bankName = wallet.bank_details?.bank_name || 'Demo Bank';
    const description = `Added funds from ${bankName}`;

    // Use atomic RPC function
    const { data: result, error: rpcError } = await supabase.rpc('process_deposit', {
      p_user_id: userId,
      p_amount: amount,
      p_description: description
    });

    if (rpcError) {
      console.error('Deposit RPC error:', rpcError);
      throw new Error(`Deposit failed: ${rpcError.message}`);
    }

    // Validate RPC result - must have success flag and transaction_id
    if (!result || typeof result !== 'object') {
      console.error('Deposit RPC returned invalid result:', result);
      throw new Error('Deposit failed: Invalid response from server');
    }

    if (!result.success) {
      console.error('Deposit failed:', result.error);
      throw new Error(result.error || 'Deposit failed');
    }

    if (!result.transaction_id) {
      console.error('Deposit RPC missing transaction_id:', result);
      throw new Error('Deposit failed: Transaction was not recorded');
    }

    console.log(`[DEMO] Deposit completed: $${amount.toFixed(2)}. New balance: $${result.new_balance}`);

    // Fetch and return the transaction
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', result.transaction_id)
      .single();

    if (txError || !transaction) {
      return {
        id: result.transaction_id,
        user_id: userId,
        type: 'deposit',
        amount: amount,
        description: description,
        direction: 'in',
        created_at: new Date().toISOString()
      } as Transaction;
    }

    return transaction as Transaction;
  }

  /**
   * Check if wallet is in demo mode
   */
  static isDemoMode(wallet: Wallet): boolean {
    return wallet.bank_details?.is_demo === true;
  }

  /**
   * ADD FUNDS VIA BLINKPAY (DEPOSIT)
   * 
   * Money Flow:
   * User's personal bank → Business holding account (via BlinkPay)
   * User's ledger balance increases
   * 
   * This is REAL MONEY coming INTO the business account
   */
  static async addFundsViaBlinkPay(
    userId: string, 
    amount: number
  ): Promise<{ transaction: Transaction; paymentId: string }> {
    // Validate amount
    if (amount <= 0) {
      throw new Error('Deposit amount must be greater than zero');
    }

    const { data: wallet } = await supabase
      .from('wallets')
      .select('blinkpay_consent_id, bank_connected')
      .eq('user_id', userId)
      .single();

    if (!wallet?.bank_connected || !wallet.blinkpay_consent_id) {
      throw new Error('Bank account must be connected via BlinkPay to add funds');
    }

    console.log(`Processing BlinkPay deposit of $${amount.toFixed(2)} for user ${userId}`);

    // Charge user's bank via Supabase Edge Function
    const { data: paymentResult, error: paymentError } = await supabase.functions.invoke('blinkpay-payment', {
      body: {
        action: 'create',
        consentId: wallet.blinkpay_consent_id,
        amount: amount.toFixed(2),
        particulars: 'Add Funds',
        reference: 'WALLET_DEPOSIT'
      },
    });

    if (paymentError || !paymentResult) {
      console.error('BlinkPay payment error:', paymentError);
      throw new Error('Failed to process bank payment');
    }

    // Wait for payment confirmation
    const { data: paymentStatus, error: statusError } = await supabase.functions.invoke('blinkpay-payment', {
      body: {
        action: 'status',
        paymentId: paymentResult.paymentId,
        maxWaitSeconds: 30
      },
    });

    if (statusError || !paymentStatus) {
      throw new Error('Failed to verify payment status');
    }

    if (paymentStatus.status !== 'completed' && paymentStatus.status !== 'AcceptedSettlementCompleted') {
      throw new Error('Payment was not completed. Your bank account was not charged.');
    }

    console.log(`BlinkPay deposit confirmed: $${amount.toFixed(2)}`);

    const description = 'Added funds from bank';

    // Use atomic RPC function to ensure transaction logging and balance update happen together
    const { data: result, error: rpcError } = await supabase.rpc('process_deposit', {
      p_user_id: userId,
      p_amount: amount,
      p_description: description
    });

    if (rpcError) {
      console.error('Deposit RPC error:', rpcError);
      throw new Error(`Deposit failed: ${rpcError.message}`);
    }

    // Validate RPC result - must have success flag and transaction_id
    if (!result || typeof result !== 'object') {
      console.error('Deposit RPC returned invalid result:', result);
      throw new Error('Deposit failed: Invalid response from server');
    }

    if (!result.success) {
      console.error('Deposit failed:', result.error);
      throw new Error(result.error || 'Deposit failed');
    }

    if (!result.transaction_id) {
      console.error('Deposit RPC missing transaction_id:', result);
      throw new Error('Deposit failed: Transaction was not recorded');
    }

    console.log(`Deposit completed: $${amount.toFixed(2)}. New balance: $${result.new_balance}`);

    // Fetch and return the transaction
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', result.transaction_id)
      .single();

    if (txError || !transaction) {
      return { 
        transaction: {
          id: result.transaction_id,
          user_id: userId,
          type: 'deposit',
          amount: amount,
          description: description,
          direction: 'in',
          created_at: new Date().toISOString()
        } as Transaction, 
        paymentId: paymentResult.paymentId 
      };
    }

    return { transaction: transaction as Transaction, paymentId: paymentResult.paymentId };
  }

  /**
   * ADD FUNDS (ADMIN/TEST ONLY)
   * 
   * This method adds funds to a user's ledger WITHOUT charging their bank.
   * Should only be used for:
   * - Admin adjustments
   * - Testing
   * - Promotional credits
   * 
   * Uses atomic RPC function for transaction safety.
   * In production, use addFundsViaBlinkPay for real deposits
   */
  static async addFunds(userId: string, amount: number): Promise<Transaction> {
    if (amount <= 0) {
      throw new Error('Amount must be greater than zero');
    }

    const description = 'Credit added to wallet';

    // Use atomic RPC function
    const { data: result, error: rpcError } = await supabase.rpc('process_deposit', {
      p_user_id: userId,
      p_amount: amount,
      p_description: description
    });

    if (rpcError) {
      console.error('Admin deposit RPC error:', rpcError);
      throw new Error(`Deposit failed: ${rpcError.message}`);
    }

    // Validate RPC result - must have success flag and transaction_id
    if (!result || typeof result !== 'object') {
      console.error('Admin deposit RPC returned invalid result:', result);
      throw new Error('Deposit failed: Invalid response from server');
    }

    if (!result.success) {
      console.error('Admin deposit failed:', result.error);
      throw new Error(result.error || 'Deposit failed');
    }

    if (!result.transaction_id) {
      console.error('Admin deposit RPC missing transaction_id:', result);
      throw new Error('Deposit failed: Transaction was not recorded');
    }

    console.log(`Admin deposit: $${amount.toFixed(2)} to user ${userId}. New balance: $${result.new_balance}`);

    // Fetch and return the transaction
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', result.transaction_id)
      .single();

    if (txError || !transaction) {
      return {
        id: result.transaction_id,
        user_id: userId,
        type: 'deposit',
        amount: amount,
        description: description,
        direction: 'in',
        created_at: new Date().toISOString()
      } as Transaction;
    }

    return transaction as Transaction;
  }

  /**
   * CHECK FOR POTENTIAL FUND CYCLING ABUSE
   * Detects if user is moving money in/out rapidly to exploit the system
   * Returns warning message if abuse detected, null if OK
   */
  static async checkWithdrawalAbuse(userId: string, withdrawalAmount: number): Promise<{ blocked: boolean; message?: string; cooldownHours?: number }> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get recent transactions
    const { data: recentTxns } = await supabase
      .from('transactions')
      .select('type, amount, direction, created_at')
      .eq('user_id', userId)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (!recentTxns || recentTxns.length === 0) {
      return { blocked: false };
    }

    // Calculate deposits and withdrawals in the last 24 hours
    const last24hTxns = recentTxns.filter(t => new Date(t.created_at) >= oneDayAgo);
    const deposits24h = last24hTxns.filter(t => t.type === 'deposit').reduce((sum, t) => sum + Number(t.amount), 0);
    const withdrawals24h = last24hTxns.filter(t => t.type === 'withdrawal').reduce((sum, t) => sum + Number(t.amount), 0);

    // Rule 1: If user deposited in last 24 hours, they cannot withdraw more than earned (non-deposit) balance
    const lastDeposit = recentTxns.find(t => t.type === 'deposit');
    if (lastDeposit && new Date(lastDeposit.created_at) >= oneDayAgo) {
      // Calculate "earned" balance (split payments received, etc.) vs deposited balance
      const earnedIn7Days = recentTxns
        .filter(t => t.type === 'split_received')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      if (withdrawalAmount > earnedIn7Days && deposits24h > 0) {
        const hoursSinceDeposit = Math.ceil((now.getTime() - new Date(lastDeposit.created_at).getTime()) / (1000 * 60 * 60));
        const cooldownRemaining = Math.max(0, 24 - hoursSinceDeposit);
        
        if (cooldownRemaining > 0) {
          return {
            blocked: true,
            message: `To prevent fund cycling, you cannot withdraw deposited funds within 24 hours. You can withdraw up to $${earnedIn7Days.toFixed(2)} (from received payments) or wait ${cooldownRemaining} more hours.`,
            cooldownHours: cooldownRemaining
          };
        }
      }
    }

    // Rule 2: Limit withdrawals to 3 per day
    const withdrawalCount24h = last24hTxns.filter(t => t.type === 'withdrawal').length;
    if (withdrawalCount24h >= 3) {
      return {
        blocked: true,
        message: 'You have reached the maximum of 3 withdrawals per day. Please try again tomorrow.'
      };
    }

    return { blocked: false };
  }

  /**
   * WITHDRAW FUNDS WITH TYPE (Fast or Normal)
   * 
   * Uses atomic RPC function to ensure transaction is logged and balance is updated together.
   * If either operation fails, the entire withdrawal is rolled back.
   * 
   * Fast Transfer: 2% fee INCLUDED in amount (not added on top), arrives in minutes to hours
   * Normal Transfer: Free, arrives in 3-5 business days
   */
  static async withdrawWithType(
    userId: string, 
    amount: number, 
    withdrawalType: 'fast' | 'normal'
  ): Promise<Transaction> {
    if (amount <= 0) {
      throw new Error('Withdrawal amount must be greater than zero');
    }

    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance, bank_connected, bank_details')
      .eq('user_id', userId)
      .single();

    if (walletError) throw walletError;
    
    if (!wallet.bank_connected) {
      throw new Error('Connect your bank account to withdraw funds');
    }

    // Calculate fee for fast transfer - fee is INCLUDED in the withdrawal amount
    // User enters $14, fee is $0.28, they receive $13.72, wallet deducted $14
    const feeRate = withdrawalType === 'fast' ? 0.02 : 0;
    const feeAmount = amount * feeRate;
    const netAmount = amount - feeAmount; // Amount user actually receives in bank

    // Get fresh balance and check BEFORE any operations
    const currentBalance = await this.getCurrentBalance(userId);
    
    // Validate against current balance
    if (currentBalance < amount) {
      throw new Error(`Insufficient balance. You can withdraw up to $${currentBalance.toFixed(2)}.`);
    }

    // Check for abuse AFTER balance validation
    const abuseCheck = await this.checkWithdrawalAbuse(userId, amount);
    if (abuseCheck.blocked) {
      throw new Error(abuseCheck.message || 'Withdrawal blocked due to suspicious activity');
    }

    // Calculate estimated arrival
    const now = new Date();
    let estimatedArrival: Date;
    if (withdrawalType === 'fast') {
      estimatedArrival = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours
    } else {
      const businessDays = 5;
      let daysToAdd = 0;
      let addedDays = 0;
      while (addedDays < businessDays) {
        daysToAdd++;
        const checkDate = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        const dayOfWeek = checkDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          addedDays++;
        }
      }
      estimatedArrival = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    }

    console.log(`Processing ${withdrawalType} withdrawal via atomic RPC: wallet deducted $${amount.toFixed(2)}, fee $${feeAmount.toFixed(2)}, user receives $${netAmount.toFixed(2)}`);

    // Use atomic RPC function - this ensures transaction is logged AND balance updated together
    // If either fails, both are rolled back
    const { data: result, error: rpcError } = await supabase.rpc('process_withdrawal', {
      p_user_id: userId,
      p_amount: amount,
      p_withdrawal_type: withdrawalType,
      p_fee_amount: feeAmount,
      p_net_amount: netAmount,
      p_estimated_arrival: estimatedArrival.toISOString()
    });

    if (rpcError) {
      console.error('Withdrawal RPC error:', rpcError);
      throw new Error(`Withdrawal failed: ${rpcError.message}`);
    }

    // Validate RPC result - must have success flag and transaction_id
    if (!result || typeof result !== 'object') {
      console.error('Withdrawal RPC returned invalid result:', result);
      throw new Error('Withdrawal failed: Invalid response from server');
    }

    if (!result.success) {
      console.error('Withdrawal failed:', result.error);
      throw new Error(result.error || 'Withdrawal failed');
    }

    if (!result.transaction_id) {
      console.error('Withdrawal RPC missing transaction_id:', result);
      throw new Error('Withdrawal failed: Transaction was not recorded');
    }

    console.log(`${withdrawalType === 'fast' ? 'Fast' : 'Standard'} withdrawal completed atomically: wallet deducted $${amount.toFixed(2)}, user receives $${netAmount.toFixed(2)}. New balance: $${result.new_balance}`);
    
    // Fetch and return the transaction
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', result.transaction_id)
      .single();

    if (txError || !transaction) {
      // Transaction was created, just can't fetch it - return a constructed object
      return {
        id: result.transaction_id,
        user_id: userId,
        type: 'withdrawal',
        amount: amount,
        description: withdrawalType === 'fast' 
          ? `Fast withdrawal to bank (Fee: $${feeAmount.toFixed(2)}, You receive: $${netAmount.toFixed(2)})`
          : 'Standard withdrawal to bank',
        direction: 'out',
        created_at: new Date().toISOString()
      } as Transaction;
    }

    return transaction as Transaction;
  }

  /**
   * WITHDRAW FUNDS (LEGACY - for backward compatibility)
   */
  static async withdraw(userId: string, amount: number): Promise<Transaction> {
    return this.withdrawWithType(userId, amount, 'normal');
  }

  /**
   * PAY FOR A SPLIT EVENT
   * 
   * Money Flow:
   * 1. If payer has wallet balance: deduct from ledger (no real money moves)
   * 2. If shortfall: charge payer's bank via BlinkPay → money goes to business holding account
   * 3. Credit recipient's ledger balance (they can withdraw later)
   * 
   * This is an INTERNAL TRANSFER - money stays in business holding account
   * Only the ledger balances change
   */
  static async paySplitEvent(
    userId: string, 
    splitEventId: string,
    amount: number,
    recipientId: string,
    eventName: string
  ): Promise<Transaction> {
    // Validate amount
    if (amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    // Get fresh wallet data
    const { data: wallet } = await supabase
      .from('wallets')
      .select('balance, bank_connected, blinkpay_consent_id, bank_details')
      .eq('user_id', userId)
      .single();

    if (!wallet) throw new Error('Wallet not found');

    const isDemoBank = wallet.bank_details?.is_demo === true;

    // Get current balance with fresh read
    const currentBalance = await this.getCurrentBalance(userId);
    
    // Calculate payment split: wallet first, then bank
    const walletPayment = Math.min(currentBalance, amount);
    const bankPayment = amount - walletPayment;

    // Validate we can complete the payment
    if (bankPayment > 0 && (!wallet.bank_connected || !wallet.blinkpay_consent_id)) {
      throw new Error(
        `Insufficient wallet balance ($${currentBalance.toFixed(2)}). ` +
        `Connect your bank to pay the remaining $${bankPayment.toFixed(2)}.`
      );
    }

    // STEP 1: Process bank payment FIRST (if needed)
    // This ensures we don't deduct wallet balance if bank charge fails
    if (bankPayment > 0) {
      if (isDemoBank) {
        console.log(`[DEMO] Processing bank charge of $${bankPayment.toFixed(2)} for split ${splitEventId}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`[DEMO] Bank payment confirmed: $${bankPayment.toFixed(2)}`);
      } else {
        console.log(`Processing BlinkPay charge of $${bankPayment.toFixed(2)} for split ${splitEventId}`);
        
        const { data: paymentResult, error: paymentError } = await supabase.functions.invoke('blinkpay-payment', {
          body: {
            action: 'create',
            consentId: wallet.blinkpay_consent_id,
            amount: bankPayment.toFixed(2),
            particulars: 'Split Payment',
            reference: splitEventId.substring(0, 12)
          },
        });

        if (paymentError || !paymentResult) {
          console.error('BlinkPay payment error:', paymentError);
          throw new Error('Bank payment failed. No charges were made.');
        }

        // Wait for payment confirmation
        const { data: paymentStatus, error: statusError } = await supabase.functions.invoke('blinkpay-payment', {
          body: {
            action: 'status',
            paymentId: paymentResult.paymentId,
            maxWaitSeconds: 30
          },
        });

        if (statusError || !paymentStatus) {
          throw new Error('Could not verify bank payment. Please try again.');
        }

        if (paymentStatus.status !== 'completed' && paymentStatus.status !== 'AcceptedSettlementCompleted') {
          throw new Error('Bank payment was not completed. Your account was not charged.');
        }

        console.log(`BlinkPay payment confirmed: $${bankPayment.toFixed(2)}`);
      }
    }

    // STEP 2: Deduct from payer's wallet (ledger adjustment)
    if (walletPayment > 0) {
      // Re-verify balance hasn't changed (race condition protection)
      const verifyBalance = await this.getCurrentBalance(userId);
      if (verifyBalance < walletPayment) {
        throw new Error('Balance changed during transaction. Please try again.');
      }

      const newPayerBalance = verifyBalance - walletPayment;
      await this.updateBalance(userId, newPayerBalance, 'split payment');
      console.log(`Deducted $${walletPayment.toFixed(2)} from payer wallet. New balance: $${newPayerBalance.toFixed(2)}`);
    }

    // STEP 3: Credit recipient's wallet AND log transaction (ledger adjustment)
    // This always happens - recipient gets full amount added to their ledger
    // Use RPC function to bypass RLS (one user can't create/update another's wallet directly)
    // The RPC also logs the transaction for the recipient
    
    const { data: creditResult, error: creditError } = await supabase.rpc('credit_recipient_wallet', {
      p_recipient_id: recipientId,
      p_amount: amount,
      p_event_name: eventName,
      p_split_event_id: splitEventId
    });

    if (creditError) {
      console.error('Failed to credit recipient wallet via RPC:', creditError);
      
      // Fallback: Try direct approach (will work if RLS allows it)
      const { data: existingRecipientWallet } = await supabase
        .from('wallets')
        .select('id, balance')
        .eq('user_id', recipientId)
        .single();

      if (!existingRecipientWallet) {
        // Try to create wallet for recipient
        const { error: createError } = await supabase
          .from('wallets')
          .insert({
            user_id: recipientId,
            balance: amount,
            bank_connected: false
          });

        if (createError) {
          console.error('Fallback: Failed to create recipient wallet:', createError);
          throw new Error('Failed to credit payment to recipient');
        }
        console.log(`Created wallet for recipient and credited $${amount.toFixed(2)}. New balance: $${amount.toFixed(2)}`);
      } else {
        // Update existing wallet balance
        const recipientBalance = parseFloat(existingRecipientWallet.balance?.toString() || '0');
        const newRecipientBalance = recipientBalance + amount;
        await this.updateBalance(recipientId, newRecipientBalance, 'split received');
        console.log(`Credited $${amount.toFixed(2)} to recipient wallet. New balance: $${newRecipientBalance.toFixed(2)}`);
      }
      
      // Fallback: Log recipient's incoming transaction (may fail due to RLS)
      try {
        await this.logTransaction(
          recipientId,
          'split_received',
          amount,
          `Received payment for ${eventName}`,
          'in',
          splitEventId
        );
      } catch (txError) {
        console.warn('Could not log recipient transaction (RLS may be blocking):', txError);
      }
    } else {
      console.log(`Credited $${amount.toFixed(2)} to recipient wallet via RPC. New balance: $${creditResult?.new_balance?.toFixed(2) || 'unknown'}`);
    }

    // STEP 4: Log payer's transaction(s)
    let payerTransaction: Transaction;

    if (walletPayment > 0 && bankPayment > 0) {
      // Hybrid payment: log both portions separately for clarity
      await this.logTransaction(
        userId,
        'split_payment',
        walletPayment,
        `Paid ${eventName} (from wallet)`,
        'out',
        splitEventId
      );

      payerTransaction = await this.logTransaction(
        userId,
        'split_payment',
        bankPayment,
        `Paid ${eventName} (from bank)`,
        'out',
        splitEventId
      );
    } else if (bankPayment > 0) {
      // Full bank payment
      payerTransaction = await this.logTransaction(
        userId,
        'split_payment',
        amount,
        `Paid ${eventName} (from bank)`,
        'out',
        splitEventId
      );
    } else {
      // Full wallet payment (internal transfer only)
      payerTransaction = await this.logTransaction(
        userId,
        'split_payment',
        amount,
        `Paid ${eventName}`,
        'out',
        splitEventId
      );
    }

    console.log(`Split payment completed: $${amount.toFixed(2)} from ${userId} to ${recipientId}`);
    return payerTransaction;
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
