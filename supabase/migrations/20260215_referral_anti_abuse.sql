-- Referral anti-abuse hardening
-- 1) wallet instrument hashes
-- 2) referral risk/audit events
-- 3) expanded referral statuses for blocked outcomes

ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS card_fingerprint TEXT NULL,
  ADD COLUMN IF NOT EXISTS bank_account_hash TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_wallets_card_fingerprint ON public.wallets(card_fingerprint);
CREATE INDEX IF NOT EXISTS idx_wallets_bank_account_hash ON public.wallets(bank_account_hash);

CREATE TABLE IF NOT EXISTS public.referral_risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NULL REFERENCES public.referrals(id) ON DELETE SET NULL,
  inviter_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  invitee_user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  phone_hash TEXT NULL,
  ip_hash TEXT NULL,
  device_hash TEXT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('allow', 'block', 'review')),
  reasons TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_risk_events_referral_id
  ON public.referral_risk_events(referral_id);
CREATE INDEX IF NOT EXISTS idx_referral_risk_events_inviter_id
  ON public.referral_risk_events(inviter_id);
CREATE INDEX IF NOT EXISTS idx_referral_risk_events_invitee_user_id
  ON public.referral_risk_events(invitee_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_risk_events_created_at
  ON public.referral_risk_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_risk_events_ip_hash
  ON public.referral_risk_events(ip_hash);
CREATE INDEX IF NOT EXISTS idx_referral_risk_events_device_hash
  ON public.referral_risk_events(device_hash);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'referrals_status_check'
      AND conrelid = 'public.referrals'::regclass
  ) THEN
    ALTER TABLE public.referrals
      DROP CONSTRAINT referrals_status_check;
  END IF;
END $$;

ALTER TABLE public.referrals
  ADD CONSTRAINT referrals_status_check
  CHECK (
    status IN (
      'pending',
      'registered',
      'card_bound',
      'blocked_risky_number',
      'blocked_shared_instrument',
      'blocked_fraud_pattern'
    )
  );
