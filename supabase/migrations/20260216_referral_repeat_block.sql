-- Prevent repeat referral rewards for the same inviter-person identity pair.
-- This table survives invitee account deletion so rewards cannot be farmed
-- by re-registering the same person.

CREATE TABLE IF NOT EXISTS public.referral_identity_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email_hash TEXT NULL,
  phone_hash TEXT NULL,
  source_referral_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (email_hash IS NOT NULL OR phone_hash IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_referral_identity_locks_inviter_id
  ON public.referral_identity_locks(inviter_id);
CREATE INDEX IF NOT EXISTS idx_referral_identity_locks_created_at
  ON public.referral_identity_locks(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_identity_locks_inviter_email
  ON public.referral_identity_locks(inviter_id, email_hash);
CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_identity_locks_inviter_phone
  ON public.referral_identity_locks(inviter_id, phone_hash);

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
      'blocked_fraud_pattern',
      'blocked_repeat_referral'
    )
  );
