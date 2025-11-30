-- Atomic RPC functions for wallet operations
-- These functions use SECURITY DEFINER to bypass RLS and ensure atomic operations
-- They also avoid PostgREST schema cache issues by being self-contained

-- =============================================================================
-- 1. LOG TRANSACTION RPC (for general transaction logging)
-- =============================================================================
DROP FUNCTION IF EXISTS log_transaction_rpc(UUID, TEXT, NUMERIC, TEXT, TEXT, UUID, JSONB);

CREATE OR REPLACE FUNCTION log_transaction_rpc(
  p_user_id UUID,
  p_type TEXT,
  p_amount NUMERIC,
  p_description TEXT,
  p_direction TEXT,
  p_split_event_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION log_transaction_rpc TO authenticated;
GRANT EXECUTE ON FUNCTION log_transaction_rpc TO service_role;

-- =============================================================================
-- 2. PROCESS DEPOSIT (atomic deposit with transaction logging)
-- =============================================================================
DROP FUNCTION IF EXISTS process_deposit(UUID, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION process_deposit(
  p_user_id UUID,
  p_amount NUMERIC,
  p_description TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
BEGIN
  -- Get current balance
  SELECT balance INTO v_current_balance
  FROM wallets
  WHERE user_id = p_user_id;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user';
  END IF;

  v_new_balance := v_current_balance + p_amount;

  -- Update wallet balance
  UPDATE wallets
  SET balance = v_new_balance, updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log the transaction (without metadata to avoid schema cache issues)
  INSERT INTO transactions (user_id, type, amount, description, direction, created_at)
  VALUES (p_user_id, 'deposit', p_amount, p_description, 'in', NOW())
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

GRANT EXECUTE ON FUNCTION process_deposit TO authenticated;
GRANT EXECUTE ON FUNCTION process_deposit TO service_role;

-- =============================================================================
-- 3. PROCESS WITHDRAWAL (atomic withdrawal with transaction logging)
-- =============================================================================
DROP FUNCTION IF EXISTS process_withdrawal(UUID, NUMERIC, TEXT, NUMERIC, NUMERIC, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION process_withdrawal(
  p_user_id UUID,
  p_amount NUMERIC,
  p_withdrawal_type TEXT,
  p_fee_amount NUMERIC,
  p_net_amount NUMERIC,
  p_estimated_arrival TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_transaction_id UUID;
  v_description TEXT;
  v_metadata JSONB;
BEGIN
  -- Get current balance
  SELECT balance INTO v_current_balance
  FROM wallets
  WHERE user_id = p_user_id;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user';
  END IF;

  -- Check sufficient balance
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Available: $%, Requested: $%', 
      ROUND(v_current_balance::numeric, 2), ROUND(p_amount::numeric, 2);
  END IF;

  v_new_balance := v_current_balance - p_amount;

  -- Build description based on withdrawal type
  IF p_withdrawal_type = 'fast' THEN
    v_description := format('Fast withdrawal to bank (Fee: $%s, You receive: $%s)', 
      ROUND(p_fee_amount::numeric, 2), ROUND(p_net_amount::numeric, 2));
  ELSE
    v_description := 'Standard withdrawal to bank';
  END IF;

  -- Build metadata
  v_metadata := jsonb_build_object(
    'withdrawal_type', p_withdrawal_type,
    'fee_amount', p_fee_amount,
    'net_amount', p_net_amount,
    'estimated_arrival', p_estimated_arrival,
    'status', 'processing'
  );

  -- Update wallet balance
  UPDATE wallets
  SET balance = v_new_balance, updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log the transaction with metadata
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

GRANT EXECUTE ON FUNCTION process_withdrawal TO authenticated;
GRANT EXECUTE ON FUNCTION process_withdrawal TO service_role;

-- =============================================================================
-- 4. Ensure metadata column exists on transactions table
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE transactions ADD COLUMN metadata JSONB;
  END IF;
END $$;

-- Grant permissions on the metadata column
GRANT SELECT, INSERT, UPDATE ON public.transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.transactions TO service_role;
