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
   * Log a transaction - MUST be called for every balance change
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
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type,
        amount,
        description,
        direction,
        split_event_id: splitEventId || null,
      })
      .select()
      .single();

    if (error) {
      console.error('CRITICAL: Failed to log transaction:', error);
      throw new Error('Failed to record transaction');
    }

    return data as Transaction;
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

    // Credit user's ledger balance
    const currentBalance = await this.getCurrentBalance(userId);
    const newBalance = currentBalance + amount;
    await this.updateBalance(userId, newBalance, 'deposit');

    // Log the transaction
    const transaction = await this.logTransaction(
      userId,
      'deposit',
      amount,
      'Added funds from bank',
      'in'
    );

    console.log(`Deposit completed: $${amount.toFixed(2)}. New balance: $${newBalance.toFixed(2)}`);
    return { transaction, paymentId: paymentResult.paymentId };
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
   * In production, use addFundsViaBlinkPay for real deposits
   */
  static async addFunds(userId: string, amount: number): Promise<Transaction> {
    if (amount <= 0) {
      throw new Error('Amount must be greater than zero');
    }

    // Get fresh balance
    const currentBalance = await this.getCurrentBalance(userId);
    const newBalance = currentBalance + amount;

    await this.updateBalance(userId, newBalance, 'admin deposit');

    const transaction = await this.logTransaction(
      userId,
      'deposit',
      amount,
      'Credit added to wallet',
      'in'
    );

    console.log(`Admin deposit: $${amount.toFixed(2)} to user ${userId}. New balance: $${newBalance.toFixed(2)}`);
    return transaction;
  }

  /**
   * WITHDRAW FUNDS (PAYOUT)
   * 
   * Money Flow:
   * Business holding account → User's personal bank
   * User's ledger balance decreases
   * 
   * NOTE: BlinkPay enduring consents only support PULLING money FROM user's bank
   * To send money TO user's bank, we need to:
   * 1. Deduct from user's ledger immediately
   * 2. Log as pending withdrawal
   * 3. Process manual bank transfer (admin action)
   * 
   * This is REAL MONEY leaving the business account
   */
  static async withdraw(userId: string, amount: number): Promise<Transaction> {
    // Validate amount
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

    // Get fresh balance
    const currentBalance = await this.getCurrentBalance(userId);
    
    if (currentBalance < amount) {
      throw new Error(`Insufficient balance. You have $${currentBalance.toFixed(2)} available.`);
    }

    console.log(`Processing withdrawal of $${amount.toFixed(2)} for user ${userId}`);

    // Deduct from ledger immediately
    const newBalance = currentBalance - amount;
    await this.updateBalance(userId, newBalance, 'withdrawal');

    // Log the withdrawal transaction
    const transaction = await this.logTransaction(
      userId,
      'withdrawal',
      amount,
      'Withdrawal to bank (processing)',
      'out'
    );

    console.log(`Withdrawal initiated: $${amount.toFixed(2)}. New balance: $${newBalance.toFixed(2)}`);
    console.log(`NOTE: Manual bank transfer required to complete this withdrawal`);
    
    return transaction;
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
      .select('balance, bank_connected, blinkpay_consent_id')
      .eq('user_id', userId)
      .single();

    if (!wallet) throw new Error('Wallet not found');

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

    // STEP 3: Credit recipient's wallet (ledger adjustment)
    // This always happens - recipient gets full amount added to their ledger
    const recipientBalance = await this.getCurrentBalance(recipientId).catch(() => 0);
    const newRecipientBalance = recipientBalance + amount;
    
    // Ensure recipient has a wallet
    const { data: recipientWallet } = await supabase
      .from('wallets')
      .select('id')
      .eq('user_id', recipientId)
      .single();

    if (recipientWallet) {
      await this.updateBalance(recipientId, newRecipientBalance, 'split received');
      console.log(`Credited $${amount.toFixed(2)} to recipient wallet. New balance: $${newRecipientBalance.toFixed(2)}`);

      // Log recipient's incoming transaction
      await this.logTransaction(
        recipientId,
        'split_received',
        amount,
        `Received payment for ${eventName}`,
        'in',
        splitEventId
      );
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
