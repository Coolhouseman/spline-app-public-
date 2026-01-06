-- RPC function to credit a recipient's wallet AND log the transaction (bypasses RLS)
-- This function runs with SECURITY DEFINER to allow one user to credit another user's wallet
-- Used when processing split payments

DROP FUNCTION IF EXISTS credit_recipient_wallet(UUID, NUMERIC);
DROP FUNCTION IF EXISTS credit_recipient_wallet(UUID, NUMERIC, TEXT, UUID);

CREATE OR REPLACE FUNCTION credit_recipient_wallet(
  p_recipient_id UUID,
  p_amount NUMERIC,
  p_event_name TEXT DEFAULT NULL,
  p_split_event_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_exists BOOLEAN;
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
  v_description TEXT;
BEGIN
  -- Check if recipient has a wallet
  SELECT EXISTS(
    SELECT 1 FROM wallets WHERE user_id = p_recipient_id
  ) INTO v_wallet_exists;
  
  IF v_wallet_exists THEN
    -- Get current balance and update
    SELECT balance INTO v_current_balance
    FROM wallets
    WHERE user_id = p_recipient_id;
    
    v_new_balance := COALESCE(v_current_balance, 0) + p_amount;
    
    UPDATE wallets
    SET balance = v_new_balance,
        updated_at = NOW()
    WHERE user_id = p_recipient_id;
  ELSE
    -- Create new wallet with the credited amount
    v_new_balance := p_amount;
    
    INSERT INTO wallets (user_id, balance, bank_connected, created_at, updated_at)
    VALUES (p_recipient_id, v_new_balance, false, NOW(), NOW());
  END IF;
  
  -- Log the transaction for the recipient
  v_description := COALESCE('Received payment for ' || p_event_name, 'Received split payment');
  
  INSERT INTO transactions (user_id, type, amount, description, direction, split_event_id, created_at)
  VALUES (p_recipient_id, 'split_received', p_amount, v_description, 'in', p_split_event_id, NOW());
  
  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'wallet_created', NOT v_wallet_exists
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION credit_recipient_wallet TO authenticated;
