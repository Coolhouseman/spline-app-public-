# Deploying BlinkPay Edge Functions to Supabase

These Edge Functions handle BlinkPay payment processing for the Spline app, replacing the need for a separate Express backend for payment operations.

## Prerequisites

1. **Supabase CLI** (version 1.150.0 or higher):
   ```bash
   npm install -g supabase
   supabase --version  # Verify installation
   ```

2. **Supabase Account**: A Supabase project with Edge Functions enabled

3. **BlinkPay Account**: Sandbox or production BlinkPay credentials
   - Client ID
   - Client Secret
   - Sandbox: https://sandbox.debit.blinkpay.co.nz
   - Production: https://debit.blinkpay.co.nz

## Initial Setup

### 1. Login to Supabase CLI
```bash
supabase login
```

### 2. Link Your Project
```bash
# Get your project reference from Supabase dashboard
supabase link --project-ref YOUR_PROJECT_REF
```

### 3. Configure BlinkPay Secrets
```bash
# Set BlinkPay credentials (required)
supabase secrets set BLINKPAY_CLIENT_ID=your_client_id
supabase secrets set BLINKPAY_CLIENT_SECRET=your_client_secret

# Verify secrets are set
supabase secrets list
```

## Deploy Functions

Deploy both Edge Functions:

```bash
# Navigate to project root (where supabase/ folder exists)
cd /path/to/project

# Deploy consent function
supabase functions deploy blinkpay-consent --no-verify-jwt

# Deploy payment function  
supabase functions deploy blinkpay-payment --no-verify-jwt
```

The `--no-verify-jwt` flag allows the functions to be called from the mobile app without requiring a Supabase auth token (the functions handle their own authentication with BlinkPay).

## Function URLs

After deployment, your functions will be available at:
- **Consent**: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/blinkpay-consent`
- **Payment**: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/blinkpay-payment`

The mobile app automatically uses these URLs via `supabase.functions.invoke()`.

## Function Endpoints

### blinkpay-consent
Handles bank connection consent management.

**Create Consent** (Initiate bank connection):
```json
POST /functions/v1/blinkpay-consent
{
  "action": "create",
  "redirectUri": "spline://wallet/callback",
  "maxAmount": "1000.00"
}
```
Response:
```json
{
  "consentId": "consent_abc123",
  "redirectUri": "https://sandbox.debit.blinkpay.co.nz/..."
}
```

**Get Consent** (Check consent status):
```json
POST /functions/v1/blinkpay-consent
{
  "action": "get",
  "consentId": "consent_abc123"
}
```
Response:
```json
{
  "consent_id": "consent_abc123",
  "bank_name": "ANZ Bank",
  "account_reference": "****1234",
  "status": "active",
  "expires_at": "2026-01-01T00:00:00Z"
}
```

**Revoke Consent** (Disconnect bank):
```json
POST /functions/v1/blinkpay-consent
{
  "action": "revoke",
  "consentId": "consent_abc123"
}
```
Response:
```json
{
  "success": true
}
```

### blinkpay-payment
Handles payment processing.

**Create Payment**:
```json
POST /functions/v1/blinkpay-payment
{
  "action": "create",
  "consentId": "consent_abc123",
  "amount": "10.00",
  "particulars": "Split Payment",
  "reference": "SPLIT-123"
}
```
Response:
```json
{
  "paymentId": "payment_xyz789",
  "status": "pending"
}
```

**Check Payment Status** (with polling):
```json
POST /functions/v1/blinkpay-payment
{
  "action": "status",
  "paymentId": "payment_xyz789",
  "maxWaitSeconds": 30
}
```
Response:
```json
{
  "paymentId": "payment_xyz789",
  "status": "completed"
}
```

## App Configuration

### Redirect URI Setup
For BlinkPay OAuth flow, configure the redirect URI in your app:

1. **Development (Expo Go)**: Use deep link scheme
   ```
   spline://wallet/callback
   ```

2. **Production**: Use your production app's deep link
   ```
   spline://wallet/callback
   ```

### Environment Variables (Already Configured)
The mobile app uses these environment variables (already set in Supabase):
- `EXPO_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key

## Switching to Production

For production deployment:

1. **Update BlinkPay URL** in both edge functions:
   ```typescript
   // Change from sandbox to production
   const BLINKPAY_URL = 'https://debit.blinkpay.co.nz';
   ```

2. **Set production secrets**:
   ```bash
   supabase secrets set BLINKPAY_CLIENT_ID=your_production_client_id
   supabase secrets set BLINKPAY_CLIENT_SECRET=your_production_client_secret
   ```

3. **Redeploy functions**:
   ```bash
   supabase functions deploy blinkpay-consent --no-verify-jwt
   supabase functions deploy blinkpay-payment --no-verify-jwt
   ```

## Local Testing

To test locally before deploying:

1. **Create `.env.local`**:
   ```bash
   BLINKPAY_CLIENT_ID=your_sandbox_client_id
   BLINKPAY_CLIENT_SECRET=your_sandbox_client_secret
   ```

2. **Serve functions locally**:
   ```bash
   supabase functions serve --env-file .env.local
   ```

3. **Test endpoints**:
   ```bash
   curl -X POST http://localhost:54321/functions/v1/blinkpay-consent \
     -H "Content-Type: application/json" \
     -d '{"action": "create", "redirectUri": "http://localhost:3000/callback"}'
   ```

## Troubleshooting

### Function Not Found
- Verify deployment succeeded with `supabase functions list`
- Check project reference is correct

### Authentication Errors
- Verify BlinkPay secrets are set: `supabase secrets list`
- Confirm credentials are for correct environment (sandbox vs production)

### CORS Errors
- Functions include CORS headers for cross-origin requests
- If issues persist, check function logs: `supabase functions logs blinkpay-consent`

### Payment Failures
- Check consent is still active (not expired/revoked)
- Verify amount format (e.g., "10.00" not "10")
- Review function logs for detailed error messages

## Legacy Express Backend Cleanup

After deploying Edge Functions successfully:

1. The Express backend is still used for daily reminders service
2. BlinkPay routes in Express (`/api/blinkpay/*`) are no longer needed
3. The `EXPO_PUBLIC_BACKEND_URL` environment variable is no longer required for BlinkPay

## Architecture Overview

```
Mobile App (Expo)
       |
       v
Supabase Client (supabase.functions.invoke)
       |
       v
Supabase Edge Functions
├── blinkpay-consent (create/get/revoke consent)
└── blinkpay-payment (create payment/check status)
       |
       v
BlinkPay API (sandbox or production)
```

This architecture eliminates the need for port forwarding and works seamlessly in:
- Expo Go on physical devices
- Production App Store/Play Store builds
- Web deployments
