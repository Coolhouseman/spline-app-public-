-- Global referral reward identity locks.
-- Prevents referral rewards from being granted more than once
-- for any previously rewarded email, phone, or card fingerprint.

CREATE TABLE IF NOT EXISTS public.referral_global_identity_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_type TEXT NOT NULL CHECK (identity_type IN ('email', 'phone', 'card')),
  identity_hash TEXT NOT NULL UNIQUE,
  first_referral_id UUID NULL REFERENCES public.referrals(id) ON DELETE SET NULL,
  first_inviter_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  first_invitee_user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_global_identity_locks_identity_type
  ON public.referral_global_identity_locks(identity_type);

CREATE INDEX IF NOT EXISTS idx_referral_global_identity_locks_created_at
  ON public.referral_global_identity_locks(created_at DESC);

-- Backfill from historical rewarded events so existing rewarded identities are locked.
INSERT INTO public.referral_global_identity_locks (
  identity_type,
  identity_hash,
  first_referral_id,
  first_inviter_id,
  first_invitee_user_id
)
SELECT
  'phone',
  rre.phone_hash,
  rre.referral_id,
  rre.inviter_id,
  rre.invitee_user_id
FROM public.referral_risk_events rre
WHERE rre.decision = 'allow'
  AND rre.reasons @> ARRAY['reward_granted']::TEXT[]
  AND rre.phone_hash IS NOT NULL
ON CONFLICT (identity_hash) DO NOTHING;

INSERT INTO public.referral_global_identity_locks (
  identity_type,
  identity_hash,
  first_referral_id,
  first_inviter_id,
  first_invitee_user_id
)
SELECT
  'email',
  (rre.metadata->>'emailHash'),
  rre.referral_id,
  rre.inviter_id,
  rre.invitee_user_id
FROM public.referral_risk_events rre
WHERE rre.decision = 'allow'
  AND rre.reasons @> ARRAY['reward_granted']::TEXT[]
  AND COALESCE(rre.metadata->>'emailHash', '') <> ''
ON CONFLICT (identity_hash) DO NOTHING;

INSERT INTO public.referral_global_identity_locks (
  identity_type,
  identity_hash,
  first_referral_id,
  first_inviter_id,
  first_invitee_user_id
)
SELECT
  'card',
  (rre.metadata->>'cardFingerprintHash'),
  rre.referral_id,
  rre.inviter_id,
  rre.invitee_user_id
FROM public.referral_risk_events rre
WHERE rre.decision = 'allow'
  AND rre.reasons @> ARRAY['reward_granted']::TEXT[]
  AND COALESCE(rre.metadata->>'cardFingerprintHash', '') <> ''
ON CONFLICT (identity_hash) DO NOTHING;
