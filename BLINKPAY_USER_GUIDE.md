# BlinkPay Integration - User Guide

## Overview

Your Split app now integrates with BlinkPay for secure, direct bank payments. Users can connect their bank account once and make future payments without re-entering credentials.

## Setup Required

### 1. Database Migration

**You must run this SQL in your Supabase SQL Editor FIRST:**

Open `UPDATE_WALLETS_FOR_BLINKPAY.md` and copy the SQL commands. This adds the necessary columns to store BlinkPay consent information.

### 2. BlinkPay Credentials

Your BlinkPay sandbox credentials are already stored as Replit secrets:
- `BLINKPAY_CLIENT_ID`
- `BLINKPAY_CLIENT_SECRET`

These are automatically loaded by the BlinkPayService.

## How It Works

### For Users: Connecting a Bank

1. **Navigate to Wallet Tab**
   - Users see their balance and a "Connect Bank Account" button

2. **Click Connect Bank**
   - Opens BlinkPay OAuth in browser
   - User selects their bank from the list
   - Redirects to bank's secure login page

3. **Authorize Enduring Consent**
   - User logs into their bank
   - Authorizes Split to make future payments
   - Bank redirects back to app

4. **Bank Connected**
   - Consent ID stored in database
   - Bank details displayed in wallet
   - Ready to make payments

### For Users: Making Payments

1. **Accept a Split Request**
   - User receives split invite
   - Views event details
   - Clicks "Accept"

2. **Pay the Split**
   - Clicks "Pay $XX.XX" button
   - App checks if bank is connected
   - If not connected, prompts to connect first

3. **Payment Processed**
   - Payment sent via BlinkPay using stored consent
   - No re-authentication needed
   - Payment marked as complete instantly

### For Users: Managing Bank Connection

**Disconnect Bank:**
- Go to Wallet tab
- Click "Disconnect" next to bank details
- Confirms disconnection
- Revokes consent at BlinkPay
- Must reconnect to make future payments

**Withdraw Funds:**
- Disabled for BlinkPay accounts
- Funds remain in Split wallet for paying friends
- This is a BlinkPay limitation

## Technical Architecture

### Service Layer

**BlinkPayService** (`services/blinkpay.service.ts`)
- `createEnduringConsent()`: Initiates OAuth flow
- `getEnduringConsent()`: Retrieves consent details
- `createPayment()`: Processes a payment
- `awaitSuccessfulPayment()`: Polls for completion
- `revokeEnduringConsent()`: Disconnects bank

**WalletService** (`services/wallet.service.ts`)
- `initiateBlinkPayConsent()`: Starts bank connection
- `completeBlinkPayConsent()`: Finalizes connection
- `disconnectBank()`: Removes bank and revokes consent

### Payment Flow

```
User clicks "Pay" 
  → Check if bank connected
  → If not: prompt to connect
  → If yes: create BlinkPay payment
  → Poll for completion (max 30 seconds)
  → If successful: mark split as paid
  → If failed: show error message
```

### Data Model

**Wallets Table (Updated)**
```sql
wallets:
  - id (uuid)
  - user_id (uuid)
  - balance (decimal)
  - bank_connected (boolean)
  - bank_details (jsonb)
  - blinkpay_consent_id (text) -- NEW
  - blinkpay_consent_status (text) -- NEW
  - blinkpay_consent_expires_at (timestamptz) -- NEW
```

## Testing in Sandbox

### BlinkPay Sandbox Banks

When testing, users will see sandbox banks like:
- PNZ Bank (Sandbox)
- ASB Bank (Sandbox)
- ANZ Bank (Sandbox)

These are test banks provided by BlinkPay. No real money is involved.

### Test Flow

1. Connect a sandbox bank in Wallet
2. Create a split event
3. Invite yourself (use another test account)
4. Accept the split
5. Click "Pay" - should process instantly
6. Verify payment marked as complete

## Common Issues

### "Bank Not Connected" Error
- User must connect bank before paying
- App will prompt them automatically
- Redirect to Wallet tab to connect

### Payment Takes Too Long
- BlinkPay polling timeout is 30 seconds
- Sandbox payments usually complete in 2-5 seconds
- Production payments may take longer

### Consent Expired
- Consents expire after 1 year
- User must reconnect their bank
- App will detect expired consent and prompt reconnection

### OAuth Redirect Not Working
- Ensure deep link scheme `split://` is registered in app.json
- WebBrowser.openAuthSessionAsync handles the redirect
- Check that redirect URI matches BlinkPay settings

## Security Notes

- Consent ID is stored encrypted in database
- Client credentials stored as Replit secrets
- No bank credentials ever stored in app
- Users can revoke consent anytime
- RLS policies protect user data

## Production Checklist

Before going live with real BlinkPay:

1. ✅ Update BlinkPay credentials to production keys
2. ✅ Change sandbox URL to production URL
3. ✅ Test with real bank accounts
4. ✅ Update maximum payment amounts if needed
5. ✅ Configure proper redirect URIs in BlinkPay dashboard
6. ✅ Enable production RLS policies in Supabase
7. ✅ Monitor payment failures and handle edge cases

---

**BlinkPay Integration Complete!**
Users can now connect their bank and make seamless split payments.
