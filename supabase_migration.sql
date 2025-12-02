-- ============================================================
-- SPLINE APP - SUPABASE DATABASE MIGRATION
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================

-- 1. Create wallets table if not exists
CREATE TABLE IF NOT EXISTS wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  balance NUMERIC DEFAULT 0,
  bank_connected BOOLEAN DEFAULT false,
  bank_details JSONB,
  stripe_customer_id TEXT,
  stripe_payment_method_id TEXT,
  card_brand TEXT,
  card_last4 TEXT,
  blinkpay_consent_id TEXT,
  blinkpay_consent_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create transactions table if not exists
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  split_event_id UUID,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. DROP ALL existing function versions using CASCADE
DO $$
BEGIN
  -- Drop all versions of log_transaction_rpc
  DROP FUNCTION IF EXISTS public.log_transaction_rpc CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  -- Drop all versions of process_deposit
  DROP FUNCTION IF EXISTS public.process_deposit CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  -- Drop all versions of process_withdrawal
  DROP FUNCTION IF EXISTS public.process_withdrawal CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  -- Drop all versions of process_split_payment
  DROP FUNCTION IF EXISTS public.process_split_payment CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  -- Drop all versions of credit_recipient_wallet
  DROP FUNCTION IF EXISTS public.credit_recipient_wallet CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4. Create RPC function: log_transaction_rpc
CREATE FUNCTION public.log_transaction_rpc(
  p_user_id UUID,
  p_type TEXT,
  p_amount NUMERIC,
  p_description TEXT,
  p_direction TEXT,
  p_split_event_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_transaction_id UUID;
BEGIN
  INSERT INTO transactions (user_id, type, amount, description, direction, split_event_id, metadata)
  VALUES (p_user_id, p_type, p_amount, p_description, p_direction, p_split_event_id, p_metadata)
  RETURNING id INTO v_transaction_id;

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 5. Create RPC function: process_deposit
CREATE FUNCTION public.process_deposit(
  p_user_id UUID,
  p_amount NUMERIC,
  p_description TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
  v_wallet_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM wallets WHERE user_id = p_user_id) INTO v_wallet_exists;
  
  IF NOT v_wallet_exists THEN
    INSERT INTO wallets (user_id, balance, bank_connected)
    VALUES (p_user_id, 0, false);
    v_current_balance := 0;
  ELSE
    SELECT balance INTO v_current_balance
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE;
  END IF;

  v_new_balance := COALESCE(v_current_balance, 0) + p_amount;

  INSERT INTO transactions (user_id, type, amount, description, direction, created_at)
  VALUES (p_user_id, 'deposit', p_amount, p_description, 'in', NOW())
  RETURNING id INTO v_transaction_id;

  UPDATE wallets
  SET balance = v_new_balance, updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'new_balance', v_new_balance
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 6. Create RPC function: process_withdrawal
CREATE FUNCTION public.process_withdrawal(
  p_user_id UUID,
  p_amount NUMERIC,
  p_withdrawal_type TEXT,
  p_fee_amount NUMERIC,
  p_net_amount NUMERIC,
  p_estimated_arrival TIMESTAMP WITH TIME ZONE,
  p_bank_account TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
  v_description TEXT;
  v_metadata JSONB;
  v_bank_masked TEXT;
  v_bank_full TEXT;
BEGIN
  SELECT balance INTO v_current_balance
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user';
  END IF;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Available: $%, Requested: $%', 
      ROUND(v_current_balance::numeric, 2), ROUND(p_amount::numeric, 2);
  END IF;

  v_new_balance := v_current_balance - p_amount;
  
  IF p_bank_account IS NOT NULL AND LENGTH(REPLACE(p_bank_account, '-', '')) > 4 THEN
    v_bank_masked := '****' || RIGHT(REPLACE(p_bank_account, '-', ''), 4);
    v_bank_full := p_bank_account;
  ELSE
    v_bank_masked := 'Bank account';
    v_bank_full := COALESCE(p_bank_account, 'Not provided');
  END IF;

  IF p_withdrawal_type = 'fast' THEN
    v_description := format('Fast withdrawal to %s (Fee: $%s, You receive: $%s)', 
      v_bank_masked, ROUND(p_fee_amount::numeric, 2), ROUND(p_net_amount::numeric, 2));
  ELSE
    v_description := format('Standard withdrawal to %s (You receive: $%s)', 
      v_bank_masked, ROUND(p_net_amount::numeric, 2));
  END IF;

  v_metadata := jsonb_build_object(
    'withdrawal_type', p_withdrawal_type,
    'fee_amount', p_fee_amount,
    'net_amount', p_net_amount,
    'estimated_arrival', p_estimated_arrival,
    'bank_account', v_bank_full,
    'bank_account_masked', v_bank_masked,
    'status', 'processing'
  );

  UPDATE wallets
  SET balance = v_new_balance, updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO transactions (user_id, type, amount, description, direction, metadata, created_at)
  VALUES (p_user_id, 'withdrawal', p_amount, v_description, 'out', v_metadata, NOW())
  RETURNING id INTO v_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'new_balance', v_new_balance
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 7. Create RPC function: process_split_payment
CREATE FUNCTION public.process_split_payment(
  p_user_id UUID,
  p_amount NUMERIC,
  p_description TEXT,
  p_split_event_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, error TEXT, new_balance NUMERIC, transaction_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_wallet_id UUID;
  v_old_balance NUMERIC;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RETURN QUERY SELECT false, 'Amount must be greater than zero'::TEXT, NULL::NUMERIC, NULL::UUID;
    RETURN;
  END IF;

  SELECT id, balance
    INTO v_wallet_id, v_old_balance
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Wallet not found'::TEXT, NULL::NUMERIC, NULL::UUID;
    RETURN;
  END IF;

  IF v_old_balance < p_amount THEN
    RETURN QUERY SELECT false, 'Insufficient balance'::TEXT, v_old_balance, NULL::UUID;
    RETURN;
  END IF;

  v_new_balance := v_old_balance - p_amount;

  UPDATE wallets
     SET balance = v_new_balance,
         updated_at = now()
   WHERE id = v_wallet_id;

  INSERT INTO transactions(
    user_id,
    type,
    amount,
    description,
    direction,
    split_event_id,
    metadata
  ) VALUES (
    p_user_id,
    'split_payment',
    p_amount,
    COALESCE(p_description, 'Split payment'),
    'out',
    p_split_event_id,
    NULLIF(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT true, NULL::TEXT, v_new_balance, v_transaction_id;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT false, SQLERRM::TEXT, NULL::NUMERIC, NULL::UUID;
END;
$$;

-- 8. Create RPC function: credit_recipient_wallet
CREATE FUNCTION public.credit_recipient_wallet(
  p_recipient_id UUID,
  p_amount NUMERIC,
  p_event_name TEXT,
  p_split_event_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
  v_wallet_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM wallets WHERE user_id = p_recipient_id) INTO v_wallet_exists;
  
  IF NOT v_wallet_exists THEN
    INSERT INTO wallets (user_id, balance, bank_connected)
    VALUES (p_recipient_id, 0, false);
    v_current_balance := 0;
  ELSE
    SELECT balance INTO v_current_balance
    FROM wallets
    WHERE user_id = p_recipient_id
    FOR UPDATE;
  END IF;

  v_new_balance := COALESCE(v_current_balance, 0) + p_amount;

  INSERT INTO transactions (user_id, type, amount, description, direction, split_event_id, metadata)
  VALUES (
    p_recipient_id,
    'split_received',
    p_amount,
    format('Received payment for %s', p_event_name),
    'in',
    p_split_event_id,
    jsonb_build_object(
      'source', 'split_payment',
      'event_name', p_event_name
    )
  )
  RETURNING id INTO v_transaction_id;

  UPDATE wallets
  SET balance = v_new_balance, updated_at = NOW()
  WHERE user_id = p_recipient_id;

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'new_balance', v_new_balance,
    'amount_credited', p_amount,
    'recipient_id', p_recipient_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 9. Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.log_transaction_rpc TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.process_deposit TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.process_withdrawal TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.process_split_payment TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.credit_recipient_wallet TO authenticated, anon;

-- 10. Enable Row Level Security
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 11. Create RLS policies for wallets
DROP POLICY IF EXISTS "Users can view own wallet" ON wallets;
CREATE POLICY "Users can view own wallet" ON wallets
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own wallet" ON wallets;
CREATE POLICY "Users can update own wallet" ON wallets
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own wallet" ON wallets;
CREATE POLICY "Users can insert own wallet" ON wallets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 12. Create RLS policies for transactions
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
CREATE POLICY "Users can insert own transactions" ON transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 13. Reload schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
