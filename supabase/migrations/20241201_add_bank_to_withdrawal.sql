-- Update process_withdrawal to properly mask bank account in descriptions
-- User-facing descriptions show masked account (****1234)
-- Full bank account is stored in metadata for admin reference only

DROP FUNCTION IF EXISTS process_withdrawal(UUID, NUMERIC, TEXT, NUMERIC, NUMERIC, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS process_withdrawal(UUID, NUMERIC, TEXT, NUMERIC, NUMERIC, TIMESTAMPTZ, TEXT);

CREATE OR REPLACE FUNCTION process_withdrawal(
  p_user_id UUID,
  p_amount NUMERIC,
  p_withdrawal_type TEXT,
  p_fee_amount NUMERIC,
  p_net_amount NUMERIC,
  p_estimated_arrival TIMESTAMPTZ,
  p_bank_account TEXT DEFAULT NULL
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
  v_bank_masked TEXT;
  v_bank_full TEXT;
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
  
  -- Mask bank account for user display (show last 4 digits only)
  -- Keep full account for admin in metadata
  IF p_bank_account IS NOT NULL AND LENGTH(REPLACE(p_bank_account, '-', '')) > 4 THEN
    v_bank_masked := '****' || RIGHT(REPLACE(p_bank_account, '-', ''), 4);
    v_bank_full := p_bank_account;
  ELSE
    v_bank_masked := 'Bank account';
    v_bank_full := COALESCE(p_bank_account, 'Not provided');
  END IF;

  -- Build description with MASKED account for user display
  IF p_withdrawal_type = 'fast' THEN
    v_description := format('Fast withdrawal to %s (Fee: $%s, You receive: $%s)', 
      v_bank_masked, ROUND(p_fee_amount::numeric, 2), ROUND(p_net_amount::numeric, 2));
  ELSE
    v_description := format('Standard withdrawal to %s (You receive: $%s)', 
      v_bank_masked, ROUND(p_net_amount::numeric, 2));
  END IF;

  -- Build metadata with FULL bank account for admin reference only
  v_metadata := jsonb_build_object(
    'withdrawal_type', p_withdrawal_type,
    'fee_amount', p_fee_amount,
    'net_amount', p_net_amount,
    'estimated_arrival', p_estimated_arrival,
    'bank_account', v_bank_full,
    'bank_account_masked', v_bank_masked,
    'status', 'processing'
  );

  -- Update wallet balance
  UPDATE wallets
  SET balance = v_new_balance, updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log the transaction with masked description and full account in metadata
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
