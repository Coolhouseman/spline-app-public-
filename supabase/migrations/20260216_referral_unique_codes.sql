-- Ensure every referral attempt uses a globally unique referral code.
-- Backfill existing rows from static inviter IDs to per-row unique codes,
-- then enforce uniqueness at the database level.

UPDATE public.referrals
SET referral_code = 'RF' || UPPER(SUBSTRING(encode(digest(id::text, 'sha256'), 'hex') FROM 1 FOR 12))
WHERE referral_code IS NULL
   OR referral_code = ''
   OR referral_code !~ '^RF[0-9A-F]{10,}$';

CREATE UNIQUE INDEX IF NOT EXISTS uq_referrals_referral_code
  ON public.referrals(referral_code);
