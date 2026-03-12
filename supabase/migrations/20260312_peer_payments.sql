-- Peer-to-peer payments and requests

CREATE TABLE IF NOT EXISTS public.peer_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  payer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  direction TEXT NOT NULL CHECK (direction IN ('pay_friend', 'request_payment')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'declined', 'cancelled')),
  receipt_image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_peer_payments_requester_id ON public.peer_payments(requester_id);
CREATE INDEX IF NOT EXISTS idx_peer_payments_payer_id ON public.peer_payments(payer_id);
CREATE INDEX IF NOT EXISTS idx_peer_payments_recipient_id ON public.peer_payments(recipient_id);
CREATE INDEX IF NOT EXISTS idx_peer_payments_status ON public.peer_payments(status);
CREATE INDEX IF NOT EXISTS idx_peer_payments_created_at ON public.peer_payments(created_at DESC);

CREATE OR REPLACE FUNCTION public.set_peer_payments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_peer_payments_updated_at ON public.peer_payments;
CREATE TRIGGER trg_peer_payments_updated_at
BEFORE UPDATE ON public.peer_payments
FOR EACH ROW
EXECUTE FUNCTION public.set_peer_payments_updated_at();

ALTER TABLE public.peer_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view related peer payments" ON public.peer_payments;
CREATE POLICY "Users can view related peer payments"
ON public.peer_payments
FOR SELECT
USING (
  auth.uid() = requester_id
  OR auth.uid() = payer_id
  OR auth.uid() = recipient_id
);

DROP POLICY IF EXISTS "Users can create own peer payments" ON public.peer_payments;
CREATE POLICY "Users can create own peer payments"
ON public.peer_payments
FOR INSERT
WITH CHECK (
  auth.uid() = requester_id
  AND (
    (direction = 'pay_friend' AND auth.uid() = payer_id AND recipient_id <> auth.uid())
    OR (direction = 'request_payment' AND auth.uid() = recipient_id AND payer_id <> auth.uid())
  )
);

DROP POLICY IF EXISTS "Users can update valid peer payments" ON public.peer_payments;
CREATE POLICY "Users can update valid peer payments"
ON public.peer_payments
FOR UPDATE
USING (
  auth.uid() = payer_id
  OR auth.uid() = requester_id
)
WITH CHECK (
  auth.uid() = payer_id
  OR auth.uid() = requester_id
);

DROP FUNCTION IF EXISTS public.credit_peer_payment_wallet(UUID, NUMERIC, TEXT, UUID, UUID, TEXT);
CREATE OR REPLACE FUNCTION public.credit_peer_payment_wallet(
  p_recipient_id UUID,
  p_amount NUMERIC,
  p_title TEXT,
  p_peer_payment_id UUID,
  p_sender_id UUID,
  p_sender_name TEXT
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
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Amount must be greater than zero'
    );
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM public.wallets
    WHERE user_id = p_recipient_id
  ) INTO v_wallet_exists;

  IF v_wallet_exists THEN
    SELECT balance
    INTO v_current_balance
    FROM public.wallets
    WHERE user_id = p_recipient_id
    FOR UPDATE;

    v_new_balance := COALESCE(v_current_balance, 0) + p_amount;

    UPDATE public.wallets
    SET balance = v_new_balance,
        updated_at = NOW()
    WHERE user_id = p_recipient_id;
  ELSE
    v_new_balance := p_amount;

    INSERT INTO public.wallets (user_id, balance, bank_connected, created_at, updated_at)
    VALUES (p_recipient_id, v_new_balance, false, NOW(), NOW());
  END IF;

  INSERT INTO public.transactions (
    user_id,
    type,
    amount,
    description,
    direction,
    metadata,
    created_at
  ) VALUES (
    p_recipient_id,
    'peer_payment_received',
    p_amount,
    format('You received a peer to peer payment from %s', COALESCE(NULLIF(p_sender_name, ''), 'Someone')),
    'in',
    jsonb_build_object(
      'peer_payment_id', p_peer_payment_id,
      'counterparty_id', p_sender_id,
      'counterparty_name', COALESCE(NULLIF(p_sender_name, ''), 'Someone'),
      'title', p_title
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'wallet_created', NOT v_wallet_exists
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

GRANT SELECT, INSERT, UPDATE ON public.peer_payments TO authenticated;
GRANT EXECUTE ON FUNCTION public.credit_peer_payment_wallet(UUID, NUMERIC, TEXT, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.credit_peer_payment_wallet(UUID, NUMERIC, TEXT, UUID, UUID, TEXT) TO service_role;
