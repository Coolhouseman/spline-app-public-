# Add BlinkPay Consent to Wallets Table

Run this SQL in your Supabase SQL Editor to add BlinkPay enduring consent tracking:

```sql
-- Add BlinkPay consent ID column to wallets table
ALTER TABLE wallets 
ADD COLUMN IF NOT EXISTS blinkpay_consent_id TEXT,
ADD COLUMN IF NOT EXISTS blinkpay_consent_status TEXT,
ADD COLUMN IF NOT EXISTS blinkpay_consent_expires_at TIMESTAMPTZ;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_wallets_consent_id ON wallets(blinkpay_consent_id);
```

## What This Does

- **blinkpay_consent_id**: Stores the BlinkPay enduring consent ID for recurring payments
- **blinkpay_consent_status**: Tracks status (active, revoked, expired)
- **blinkpay_consent_expires_at**: When the consent expires (usually 1 year from creation)

## Why This Is Needed

When users connect their bank via BlinkPay:
1. They authorize an "enduring consent" for recurring payments
2. The consent_id is stored in the wallet
3. Future payments use this consent_id without re-authorization
4. This enables seamless split payments directly from their bank account

---

**Run this SQL now before continuing with BlinkPay integration!**
