# Deploying BlinkPay Edge Functions to Supabase

These Edge Functions handle BlinkPay payment processing for the Spline app.

## Prerequisites

1. Supabase CLI installed: `npm install -g supabase`
2. Logged into Supabase: `supabase login`
3. Project linked: `supabase link --project-ref YOUR_PROJECT_REF`

## Set BlinkPay Secrets

Before deploying, add your BlinkPay credentials as secrets in Supabase:

```bash
supabase secrets set BLINKPAY_CLIENT_ID=your_client_id
supabase secrets set BLINKPAY_CLIENT_SECRET=your_client_secret
```

## Deploy Functions

Deploy both Edge Functions:

```bash
# Deploy consent function
supabase functions deploy blinkpay-consent --no-verify-jwt

# Deploy payment function  
supabase functions deploy blinkpay-payment --no-verify-jwt
```

The `--no-verify-jwt` flag allows the functions to be called from the mobile app without requiring a Supabase auth token (the functions handle their own authentication with BlinkPay).

## Verify Deployment

After deployment, your functions will be available at:
- `https://YOUR_PROJECT_REF.supabase.co/functions/v1/blinkpay-consent`
- `https://YOUR_PROJECT_REF.supabase.co/functions/v1/blinkpay-payment`

## Function Endpoints

### blinkpay-consent
Handles bank connection consent management.

**Create Consent:**
```json
POST /functions/v1/blinkpay-consent
{
  "action": "create",
  "redirectUri": "https://your-app.com/callback"
}
```

**Get Consent:**
```json
POST /functions/v1/blinkpay-consent
{
  "action": "get",
  "consentId": "consent_id_here"
}
```

**Revoke Consent:**
```json
POST /functions/v1/blinkpay-consent
{
  "action": "revoke",
  "consentId": "consent_id_here"
}
```

### blinkpay-payment
Handles payment processing.

**Create Payment:**
```json
POST /functions/v1/blinkpay-payment
{
  "action": "create",
  "consentId": "consent_id_here",
  "amount": "10.00",
  "particulars": "Split Payment",
  "reference": "REF123"
}
```

**Check Payment Status:**
```json
POST /functions/v1/blinkpay-payment
{
  "action": "status",
  "paymentId": "payment_id_here",
  "maxWaitSeconds": 30
}
```

## Troubleshooting

1. **Function not found:** Ensure you've deployed with the correct project reference
2. **Authentication errors:** Verify BlinkPay secrets are set correctly
3. **CORS errors:** The functions include CORS headers for cross-origin requests

## Local Testing

To test locally before deploying:

```bash
supabase functions serve blinkpay-consent --env-file .env.local
supabase functions serve blinkpay-payment --env-file .env.local
```

Create a `.env.local` file with:
```
BLINKPAY_CLIENT_ID=your_client_id
BLINKPAY_CLIENT_SECRET=your_client_secret
```
