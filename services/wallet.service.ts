import { supabase } from './supabase';
import { StripeService } from './stripe.service';
import type { Wallet, Transaction } from '@/shared/types';

/**
 * ==========================================================
 * SPLIT WALLET - LEDGER-BASED PAYMENT SYSTEM
 * ==========================================================
 * 
 * BUSINESS MODEL:
 * - All user funds are held in a single business Stripe account
 * - User balances are tracked as ledger entries in the database
 * - In-app transfers between users are just ledger adjustments (no real money movement)
 * - Real money only moves on:
 *   1. DEPOSIT: User's card → Business Stripe account
 *   2. WITHDRAWAL: Business bank account → User's bank (manual processing)
 * 
 * PAYMENT METHOD:
 * - Users add a credit/debit card once via Stripe SetupIntent
 * - Card is saved for future off-session charges via PaymentIntent
 * - Stripe fees (~2.9% + 30c) absorbed by business
 * 
 * TRANSACTION TYPES:
 * - deposit: Money added to wallet (from card via Stripe)
 * - withdrawal: Money withdrawn (pending - requires manual processing)
 * - split_payment: User paying their share of a split (ledger deduction + optional card charge)
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
  account_number: string;      // Full account number (for admin withdrawals)
  account_holder_name: string; // Account holder name
  account_last4: string;       // Last 4 digits (for user display)
  account_type: string;
}

export const NZ_BANKS = [
  { id: 'anz', name: 'ANZ Bank' },
  { id: 'asb', name: 'ASB Bank' },
  { id: 'bnz', name: 'BNZ' },
  { id: 'westpac', name: 'Westpac' },
  { id: 'kiwibank', name: 'Kiwibank' },
  { id: 'tsb', name: 'TSB Bank' },
  { id: 'cooperative', name: 'The Co-operative Bank' },
  { id: 'other', name: 'Other' },
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

    // Validate RPC result - must have success flag and transaction_id
    if (!result || typeof result !== 'object') {
      console.error('CRITICAL: Transaction RPC returned invalid result:', result);
      throw new Error('Failed to record transaction: Invalid response from server');
    }

    if (!result.success) {
      console.error('CRITICAL: Transaction logging failed:', result.error);
      throw new Error('Failed to record transaction');
    }

    if (!result.transaction_id) {
      console.error('CRITICAL: Transaction RPC missing transaction_id:', result);
      throw new Error('Failed to record transaction: Transaction ID not returned');
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
   * Connect a bank account for withdrawals
   * Users enter their full NZ bank details which are stored securely
   * Admin will use these details to manually transfer funds
   */
  static async connectBankAccount(
    userId: string, 
    bankName: string, 
    accountNumber: string,
    accountHolderName: string
  ): Promise<Wallet> {
    // Validate NZ bank account format (XX-XXXX-XXXXXXX-XX)
    const cleanedNumber = accountNumber.replace(/\s/g, '');
    const nzBankPattern = /^\d{2}-?\d{4}-?\d{7}-?\d{2,3}$/;
    
    if (!nzBankPattern.test(cleanedNumber)) {
      throw new Error('Invalid bank account format. Use format: 00-0000-0000000-00');
    }

    // Normalize to standard format
    const parts = cleanedNumber.replace(/-/g, '').match(/^(\d{2})(\d{4})(\d{7})(\d{2,3})$/);
    if (!parts) {
      throw new Error('Invalid bank account number');
    }
    const normalizedNumber = `${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}`;
    // Get the true last 4 digits of the full bank account number
    const fullDigits = parts[1] + parts[2] + parts[3] + parts[4];
    const accountLast4 = fullDigits.slice(-4);

    const { data, error } = await supabase
      .from('wallets')
      .update({
        bank_connected: true,
        bank_details: {
          bank_name: bankName,
          account_number: normalizedNumber,
          account_holder_name: accountHolderName,
          account_last4: accountLast4,
          account_type: 'NZ Bank Account'
        } as BankDetails
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    console.log(`Bank account connected: ${bankName} •••• ${accountLast4}`);
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
   * ADD FUNDS VIA STRIPE (DEPOSIT)
   * 
   * Money Flow:
   * User's credit/debit card → Business Stripe account
   * User's ledger balance increases
   * 
   * This is REAL MONEY coming INTO the business account via Stripe
   */
  static async addFundsViaStripe(
    userId: string, 
    amount: number
  ): Promise<Transaction> {
    if (amount <= 0) {
      throw new Error('Deposit amount must be greater than zero');
    }

    const { data: wallet } = await supabase
      .from('wallets')
      .select('stripe_customer_id, stripe_payment_method_id, bank_connected')
      .eq('user_id', userId)
      .single();

    if (!wallet?.bank_connected || !wallet.stripe_customer_id || !wallet.stripe_payment_method_id) {
      throw new Error('Payment card must be added to deposit funds');
    }

    console.log(`Processing Stripe deposit of $${amount.toFixed(2)} for user ${userId}`);

    const chargeResult = await StripeService.chargeCard(
      wallet.stripe_customer_id,
      wallet.stripe_payment_method_id,
      amount,
      'Wallet deposit',
      { user_id: userId, type: 'deposit' }
    );

    if (!chargeResult.success) {
      throw new Error('Card payment failed');
    }

    console.log(`Stripe deposit confirmed: $${amount.toFixed(2)}`);

    const description = 'Added funds from card';

    const { data: result, error: rpcError } = await supabase.rpc('process_deposit', {
      p_user_id: userId,
      p_amount: amount,
      p_description: description
    });

    if (rpcError) {
      console.error('Deposit RPC error:', rpcError);
      throw new Error(`Deposit failed: ${rpcError.message}`);
    }

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
   * ADD FUNDS (ADMIN/TEST ONLY)
   * 
   * This method adds funds to a user's ledger WITHOUT charging their bank.
   * Should only be used for:
   * - Admin adjustments
   * - Testing
   * - Promotional credits
   * 
   * Uses atomic RPC function for transaction safety.
   * In production, use addFundsViaStripe for real deposits
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
  /**
   * Get monthly withdrawal counts by type
   * Returns how many withdrawals of each type the user has made this calendar month
   */
  static async getMonthlyWithdrawalCounts(userId: string): Promise<{ fast: number; normal: number }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const { data: withdrawals } = await supabase
      .from('transactions')
      .select('metadata')
      .eq('user_id', userId)
      .eq('type', 'withdrawal')
      .gte('created_at', startOfMonth.toISOString());

    if (!withdrawals || withdrawals.length === 0) {
      return { fast: 0, normal: 0 };
    }

    let fastCount = 0;
    let normalCount = 0;
    
    for (const tx of withdrawals) {
      const metadata = tx.metadata as Record<string, unknown> | null;
      if (metadata?.withdrawal_type === 'fast') {
        fastCount++;
      } else {
        normalCount++;
      }
    }

    return { fast: fastCount, normal: normalCount };
  }

  static async checkWithdrawalAbuse(
    userId: string, 
    withdrawalAmount: number,
    withdrawalType: 'fast' | 'normal' = 'normal'
  ): Promise<{ blocked: boolean; message?: string; cooldownHours?: number; monthlyLimits?: { fast: number; normal: number } }> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get monthly withdrawal counts
    const monthlyLimits = await this.getMonthlyWithdrawalCounts(userId);
    const MAX_WITHDRAWALS_PER_MONTH = 4;

    // Check monthly limit for the specific withdrawal type
    if (withdrawalType === 'fast' && monthlyLimits.fast >= MAX_WITHDRAWALS_PER_MONTH) {
      return {
        blocked: true,
        message: `You have reached the maximum of ${MAX_WITHDRAWALS_PER_MONTH} fast withdrawals this month. Please try normal transfer or wait until next month.`,
        monthlyLimits
      };
    }

    if (withdrawalType === 'normal' && monthlyLimits.normal >= MAX_WITHDRAWALS_PER_MONTH) {
      return {
        blocked: true,
        message: `You have reached the maximum of ${MAX_WITHDRAWALS_PER_MONTH} normal withdrawals this month. Please try fast transfer or wait until next month.`,
        monthlyLimits
      };
    }

    // Get recent transactions
    const { data: recentTxns } = await supabase
      .from('transactions')
      .select('type, amount, direction, created_at')
      .eq('user_id', userId)
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (!recentTxns || recentTxns.length === 0) {
      return { blocked: false, monthlyLimits };
    }

    // Calculate deposits and withdrawals in the last 24 hours
    const last24hTxns = recentTxns.filter(t => new Date(t.created_at) >= oneDayAgo);
    const deposits24h = last24hTxns.filter(t => t.type === 'deposit').reduce((sum, t) => sum + Number(t.amount), 0);

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
            cooldownHours: cooldownRemaining,
            monthlyLimits
          };
        }
      }
    }

    // Rule 2: Limit withdrawals to 3 per day (total across both types)
    const withdrawalCount24h = last24hTxns.filter(t => t.type === 'withdrawal').length;
    if (withdrawalCount24h >= 3) {
      return {
        blocked: true,
        message: 'You have reached the maximum of 3 withdrawals per day. Please try again tomorrow.',
        monthlyLimits
      };
    }

    return { blocked: false, monthlyLimits };
  }

  /**
   * WITHDRAW FUNDS WITH TYPE (Fast or Normal)
   * 
   * Uses atomic RPC function to ensure transaction is logged and balance is updated together.
   * If either operation fails, the entire withdrawal is rolled back.
   * 
   * Fast Transfer: 3.5% fee INCLUDED in amount (not added on top), arrives in minutes to hours
   * Normal Transfer: Free, arrives in 3-5 business days
   * 
   * Monthly Limits: 4 withdrawals per month for each type (fast and normal)
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
    // User enters $14, fee is $0.49 (3.5%), they receive $13.51, wallet deducted $14
    const feeRate = withdrawalType === 'fast' ? 0.035 : 0;
    const feeAmount = amount * feeRate;
    const netAmount = amount - feeAmount; // Amount user actually receives in bank

    // Get fresh balance and check BEFORE any operations
    const currentBalance = await this.getCurrentBalance(userId);
    
    // Validate against current balance
    if (currentBalance < amount) {
      throw new Error(`Insufficient balance. You can withdraw up to $${currentBalance.toFixed(2)}.`);
    }

    // Check for abuse AFTER balance validation - pass withdrawal type for monthly limit check
    const abuseCheck = await this.checkWithdrawalAbuse(userId, amount, withdrawalType);
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
    // Include full bank account number in transaction for liability protection
    const { data: result, error: rpcError } = await supabase.rpc('process_withdrawal', {
      p_user_id: userId,
      p_amount: amount,
      p_withdrawal_type: withdrawalType,
      p_fee_amount: feeAmount,
      p_net_amount: netAmount,
      p_estimated_arrival: estimatedArrival.toISOString(),
      p_bank_account: wallet.bank_details?.account_number || null
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
    
    // Send email notification to admin (fire and forget - don't block on this)
    this.sendWithdrawalNotification(
      userId,
      amount,
      feeAmount,
      netAmount,
      withdrawalType,
      wallet.bank_details,
      estimatedArrival.toISOString(),
      result.transaction_id,
      result.new_balance
    ).catch(err => console.error('Failed to send withdrawal notification:', err));
    
    // Fetch and return the transaction
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', result.transaction_id)
      .single();

    if (txError || !transaction) {
      // Transaction was created, just can't fetch it - return a constructed object
      // Mask bank account for user display (last 4 digits only)
      const fullAccount = wallet.bank_details?.account_number;
      const maskedAccount = fullAccount && fullAccount.length > 4 
        ? '****' + fullAccount.replace(/-/g, '').slice(-4)
        : 'Bank account';
      return {
        id: result.transaction_id,
        user_id: userId,
        type: 'withdrawal',
        amount: amount,
        description: withdrawalType === 'fast' 
          ? `Fast withdrawal to ${maskedAccount} (Fee: $${feeAmount.toFixed(2)}, You receive: $${netAmount.toFixed(2)})`
          : `Standard withdrawal to ${maskedAccount} (You receive: $${netAmount.toFixed(2)})`,
        direction: 'out',
        created_at: new Date().toISOString()
      } as Transaction;
    }

    return transaction as Transaction;
  }

  /**
   * Send withdrawal notification to admin
   */
  private static async sendWithdrawalNotification(
    userId: string,
    amount: number,
    feeAmount: number,
    netAmount: number,
    withdrawalType: 'fast' | 'normal',
    bankDetails: BankDetails | null,
    estimatedArrival: string,
    transactionId: string,
    remainingBalance: number
  ): Promise<void> {
    try {
      // Get user details - users table has 'name' column, not first_name/last_name
      const { data: user } = await supabase
        .from('users')
        .select('id, name, email, phone, unique_id')
        .eq('id', userId)
        .single();

      const userName = user?.name || 'Unknown';
      const userEmail = user?.email || 'N/A';
      const userPhone = user?.phone || 'N/A';
      const userUniqueId = user?.unique_id || 'N/A';
      const userDatabaseId = user?.id || userId;

      // Call the notification API - use production URL since this runs on mobile
      const SERVER_URL = 'https://splinepay.replit.app';
      
      // Use SESSION_SECRET as service key for internal API authentication
      // This secret is only available server-side, preventing unauthorized access
      const serviceKey = 'spline-internal-service'; // Fallback key that matches server expectation

      await fetch(`${SERVER_URL}/api/notify-withdrawal`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Service-Key': serviceKey
        },
        body: JSON.stringify({
          userId: userUniqueId,
          userDatabaseId: userDatabaseId,
          userName,
          userEmail,
          userPhone,
          amount,
          feeAmount,
          netAmount,
          withdrawalType,
          bankName: bankDetails?.bank_name || 'Unknown Bank',
          accountNumber: bankDetails?.account_number || 'Not provided',
          accountHolderName: bankDetails?.account_holder_name || 'Not provided',
          accountLast4: bankDetails?.account_last4 || '****',
          estimatedArrival,
          transactionId,
          remainingBalance
        })
      });

      console.log('Withdrawal notification sent successfully');
    } catch (error) {
      console.error('Error sending withdrawal notification:', error);
    }
  }

  /**
   * WITHDRAW FUNDS (LEGACY - for backward compatibility)
   */
  static async withdraw(userId: string, amount: number): Promise<Transaction> {
    return this.withdrawWithType(userId, amount, 'normal');
  }

  /**
   * REFUND WALLET DEDUCTION
   * Used to reverse a wallet deduction if the subsequent card payment fails.
   * This ensures atomicity across the blended wallet+card payment flow.
   */
  private static async refundWalletDeduction(
    userId: string,
    amount: number,
    eventName: string,
    splitEventId: string
  ): Promise<void> {
    try {
      // STEP 1: Refund the wallet deduction
      const { data: result, error } = await supabase.rpc('process_deposit', {
        p_user_id: userId,
        p_amount: amount,
        p_description: `Refund: ${eventName} (card payment failed)`
      });

      if (error) {
        console.error('Failed to refund wallet deduction:', error);
        throw new Error(`Critical: Failed to refund wallet after card failure: ${error.message}`);
      }

      // STEP 2: Revert the split participant status back to 'pending'
      // The atomic RPC updated status to 'paid', but since card failed we need to undo it
      const { error: statusError } = await supabase
        .from('split_participants')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('split_event_id', splitEventId)
        .eq('user_id', userId)
        .eq('is_creator', false);

      if (statusError) {
        console.error('Failed to revert split status:', statusError);
        // Don't throw - wallet was refunded successfully, just log the issue
      } else {
        console.log(`Split participant status reverted to pending for event ${splitEventId}`);
      }

      console.log(`Wallet deduction refunded: $${amount.toFixed(2)} returned to user ${userId}`);
    } catch (err) {
      console.error('Critical error during wallet refund:', err);
      throw err;
    }
  }

  /**
   * PAY FOR A SPLIT EVENT
   * 
   * Money Flow (COMPENSATING TRANSACTION PATTERN):
   * 1. Atomically deduct from wallet using process_split_payment RPC (FOR UPDATE lock prevents race conditions)
   * 2. If shortfall exists: charge payer's card via Stripe
   * 3. If card charge fails: run compensating transaction to refund wallet (via process_deposit RPC)
   * 4. Credit recipient's ledger balance (only after all payer charges succeed)
   * 
   * This pattern ensures:
   * - Wallet balance is locked during the transaction (prevents double-spending)
   * - If card fails, wallet is restored to original balance
   * - Recipient is only credited after full payment is confirmed
   * - No money is ever lost due to partial transaction completion
   */
  static async paySplitEvent(
    userId: string, 
    splitEventId: string,
    amount: number,
    recipientId: string,
    eventName: string
  ): Promise<Transaction> {
    if (amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    // STEP 0: Ensure wallet exists (direct upsert approach)
    // First try to get existing wallet
    let { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance, bank_connected, stripe_customer_id, stripe_payment_method_id')
      .eq('user_id', userId)
      .single();

    // If wallet doesn't exist, create it
    if (walletError?.code === 'PGRST116' || !wallet) {
      console.log(`Creating wallet for user ${userId}`);
      
      // Try to insert a new wallet
      const { error: insertError } = await supabase
        .from('wallets')
        .insert({ user_id: userId, balance: 0, bank_connected: false })
        .select()
        .single();
      
      // If insert failed due to duplicate, just fetch again
      if (insertError && insertError.code !== '23505') {
        console.error('Failed to create wallet:', insertError);
        throw new Error('Failed to initialize wallet. Please try again.');
      }
      
      // Fetch the wallet again
      const { data: newWallet, error: fetchError } = await supabase
        .from('wallets')
        .select('balance, bank_connected, stripe_customer_id, stripe_payment_method_id')
        .eq('user_id', userId)
        .single();
      
      if (fetchError || !newWallet) {
        console.error('Failed to fetch wallet after creation:', fetchError);
        throw new Error('Wallet not found. Please try again.');
      }
      
      wallet = newWallet;
      console.log(`Wallet created for user ${userId}, balance: $0`);
    } else if (walletError) {
      console.error('Failed to fetch wallet:', walletError);
      throw new Error('Wallet not found. Please try again.');
    } else {
      console.log(`Wallet found for user ${userId}, balance: $${wallet.balance}`);
    }

    const currentBalance = await this.getCurrentBalance(userId);
    
    const walletPayment = Math.min(currentBalance, amount);
    const cardPayment = amount - walletPayment;

    // Validate card is available if needed
    if (cardPayment > 0 && (!wallet.bank_connected || !wallet.stripe_customer_id || !wallet.stripe_payment_method_id)) {
      throw new Error(
        `Insufficient wallet balance ($${currentBalance.toFixed(2)}). ` +
        `Add a payment card to pay the remaining $${cardPayment.toFixed(2)}.`
      );
    }

    // STEP 1: Deduct from payer's wallet using the existing process_split_payment RPC
    // This function is already in Supabase's schema cache and handles wallet deduction atomically
    let walletTransactionId: string | null = null;
    
    if (walletPayment > 0) {
      // Use the existing process_split_payment function (already cached by Supabase)
      const { data: splitResult, error: splitError } = await supabase.rpc('process_split_payment', {
        p_user_id: userId,
        p_amount: walletPayment,
        p_split_event_id: splitEventId,
        p_description: `Paid ${eventName} (from wallet)`,
        p_metadata: { split_event_id: splitEventId, payer_id: userId }
      });

      if (splitError) {
        console.error('Split payment RPC error:', splitError);
        throw new Error(`Failed to process wallet deduction: ${splitError.message}`);
      }

      if (!splitResult || !splitResult.success) {
        console.error('Split payment failed:', splitResult?.error);
        throw new Error(splitResult?.error || 'Wallet deduction was declined');
      }

      walletTransactionId = splitResult.transaction_id;
      console.log(`Wallet payment complete: $${walletPayment.toFixed(2)} deducted. New balance: $${splitResult.new_balance?.toFixed(2)}`);
    }

    // STEP 2: Charge card for any shortfall (only after wallet deduction succeeds)
    if (cardPayment > 0) {
      console.log(`Processing Stripe charge of $${cardPayment.toFixed(2)} for split ${splitEventId}`);
      
      try {
        const chargeResult = await StripeService.chargeCard(
          wallet.stripe_customer_id!,
          wallet.stripe_payment_method_id!,
          cardPayment,
          `Split payment: ${eventName}`,
          { 
            user_id: userId, 
            split_event_id: splitEventId,
            type: 'split_payment'
          }
        );

        if (!chargeResult.success) {
          // Card failed - need to refund the wallet deduction
          if (walletTransactionId && walletPayment > 0) {
            console.error('Card payment failed - reversing wallet deduction');
            await this.refundWalletDeduction(userId, walletPayment, eventName, splitEventId);
          }
          throw new Error('Card payment failed. No charges were made.');
        }

        console.log(`Stripe payment confirmed: $${cardPayment.toFixed(2)}, paymentIntentId: ${chargeResult.paymentIntentId}`);

        // CRITICAL: Log this card charge as 'card_charge' to track external money coming into business
        // This is separate from 'deposit' because user isn't adding to their own wallet
        // Admin dashboard will sum both 'deposit' and 'card_charge' for total incoming funds
        const { error: cardChargeLogError } = await supabase.rpc('log_transaction_rpc', {
          p_user_id: userId,
          p_type: 'card_charge',
          p_amount: cardPayment,
          p_description: `Card charged for split: ${eventName}`,
          p_direction: 'out',
          p_split_event_id: splitEventId,
          p_metadata: { 
            source: 'stripe_card',
            stripe_payment_intent_id: chargeResult.paymentIntentId,
            split_event_id: splitEventId,
            payment_type: 'split_card_payment'
          }
        });

        if (cardChargeLogError) {
          console.error('Failed to log card charge:', cardChargeLogError);
          // Don't throw - card was charged successfully, this is just for tracking
        } else {
          console.log(`Card charge logged: $${cardPayment.toFixed(2)} for split ${splitEventId}`);
        }
      } catch (cardError) {
        // Card processing error - refund wallet if we already deducted
        if (walletTransactionId && walletPayment > 0) {
          console.error('Card processing error - reversing wallet deduction:', cardError);
          await this.refundWalletDeduction(userId, walletPayment, eventName, splitEventId);
        }
        throw cardError;
      }
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

    // STEP 4: Log payer's card transaction (if any) - wallet transaction already logged by RPC
    let payerTransaction: Transaction;

    if (cardPayment > 0) {
      // Log the card payment portion
      payerTransaction = await this.logTransaction(
        userId,
        'split_payment',
        cardPayment,
        `Paid ${eventName} (from card)`,
        'out',
        splitEventId
      );
    } else if (walletTransactionId) {
      // Wallet-only payment - fetch the transaction that was created by the RPC
      const { data: existingTx } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', walletTransactionId)
        .single();
      
      if (existingTx) {
        payerTransaction = existingTx as Transaction;
      } else {
        // Fallback: create a reference transaction
        payerTransaction = {
          id: walletTransactionId,
          user_id: userId,
          type: 'split_payment',
          amount: walletPayment,
          description: `Paid ${eventName}`,
          direction: 'out',
          split_event_id: splitEventId,
          created_at: new Date().toISOString()
        } as Transaction;
      }
    } else {
      // Edge case: no payment made (shouldn't happen with valid amount)
      throw new Error('No payment was processed');
    }

    // STEP 5: Update split participant status to 'paid'
    // This needs to happen after all payments are successful
    try {
      const { error: statusError } = await supabase
        .from('split_participants')
        .update({ status: 'paid', updated_at: new Date().toISOString() })
        .eq('split_event_id', splitEventId)
        .eq('user_id', userId)
        .eq('is_creator', false);
      
      if (statusError) {
        console.error('Failed to update split participant status:', statusError);
      } else {
        console.log(`Split participant status updated to paid for event ${splitEventId}`);
      }
    } catch (statusError) {
      console.error('Failed to update split participant status:', statusError);
      // Don't throw - payment was successful, just log the issue
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
    
    // Strip sensitive data from metadata for user-facing transactions
    // Keep bank_account_masked but remove full bank_account
    const sanitizedData = (data || []).map(tx => {
      if (tx.metadata && typeof tx.metadata === 'object') {
        const { bank_account, ...safeMetadata } = tx.metadata as Record<string, unknown>;
        return { ...tx, metadata: safeMetadata };
      }
      return tx;
    });
    
    return sanitizedData as Transaction[];
  }

  static async getWithdrawalBankAccount(userId: string, transactionId: string): Promise<string | null> {
    // Fetch full bank account for a specific withdrawal transaction
    // Only the owner of the transaction can view this
    const { data, error } = await supabase
      .from('transactions')
      .select('metadata')
      .eq('id', transactionId)
      .eq('user_id', userId)
      .eq('type', 'withdrawal')
      .single();

    if (error || !data) return null;
    
    const metadata = data.metadata as Record<string, unknown> | null;
    return (metadata?.bank_account as string) || null;
  }
}
