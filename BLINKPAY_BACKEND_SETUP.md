# BlinkPay Backend Server Setup

## Problem

The BlinkPay Node.js SDK (`blink-debit-api-client-node`) is designed for Node.js environments and uses modules like `dotenv`, `path`, and `process.cwd()` that are not available in React Native/Expo environments. When you tried to import the SDK directly in the Expo app, it caused this error:

```
Unable to resolve module path from /home/runner/workspace/node_modules/dotenv/lib/main.js
```

## Solution

We've created a lightweight Express backend server that:
1. Runs the BlinkPay Node.js SDK in a proper Node.js environment
2. Exposes REST API endpoints that the React Native app can call
3. Runs alongside the Expo dev server in Replit

## Architecture

```
┌─────────────────────┐         ┌──────────────────────┐
│  React Native App   │         │  Express Backend     │
│  (Expo Go)          │         │  (Node.js)           │
│                     │         │                      │
│  WalletService      │────────▶│  /api/blinkpay/*     │
│  EventDetailScreen  │  HTTP   │                      │
│                     │  Fetch  │  BlinkPayService     │
│                     │         │                      │
└─────────────────────┘         └───────────┬──────────┘
                                            │
                                            │
                                            ▼
                                  ┌──────────────────┐
                                  │  BlinkPay API    │
                                  │  (Sandbox)       │
                                  └──────────────────┘
```

## File Structure

### Backend Server (New)
```
server/
├── index.ts                      # Express server entry point
├── routes/
│   └── blinkpay.routes.ts        # BlinkPay API endpoints
└── services/
    └── blinkpay.service.ts       # BlinkPay SDK wrapper
```

### Client (Updated)
```
services/
├── wallet.service.ts             # Calls backend API (updated)
└── ...

screens/
├── EventDetailScreen.tsx         # Calls backend API (updated)
└── ...
```

## API Endpoints

### POST /api/blinkpay/consent/create
Creates an enduring consent for bank connection.

**Request:**
```json
{
  "redirectUri": "split://blinkpay/callback",
  "maxAmountPerPeriod": "1000.00"
}
```

**Response:**
```json
{
  "consentId": "consent_abc123",
  "redirectUri": "https://blinkpay.co.nz/authorize?..."
}
```

### GET /api/blinkpay/consent/:consentId
Retrieves consent details.

**Response:**
```json
{
  "consent_id": "consent_abc123",
  "bank_name": "Connected Bank",
  "account_reference": "****1234",
  "status": "active",
  "expires_at": "2026-11-25T00:00:00Z"
}
```

### POST /api/blinkpay/consent/revoke
Revokes an enduring consent.

**Request:**
```json
{
  "consentId": "consent_abc123"
}
```

**Response:**
```json
{
  "success": true
}
```

### POST /api/blinkpay/payment/create
Creates a payment using enduring consent.

**Request:**
```json
{
  "consentId": "consent_abc123",
  "amount": "50.00",
  "particulars": "Split Payment",
  "reference": "split_xyz789"
}
```

**Response:**
```json
{
  "paymentId": "payment_abc123",
  "status": "pending"
}
```

### GET /api/blinkpay/payment/:paymentId/status
Polls for payment completion status.

**Query Parameters:**
- `maxWaitSeconds`: Maximum time to wait (default: 30)

**Response:**
```json
{
  "paymentId": "payment_abc123",
  "status": "AcceptedSettlementCompleted"
}
```

## Running the App

### Option 1: Manual Start (For Development)

**Terminal 1 - Backend Server:**
```bash
PORT=8082 npx nodemon server/index.ts
```

**Terminal 2 - Expo Dev Server:**
```bash
npm run dev
```

### Option 2: Using Start Script (Recommended)

We've created a `start-all.sh` script that runs both servers:

```bash
./start-all.sh
```

This starts:
- Backend server on port 8082 (external port 3000 in Replit)
- Expo dev server on port 8081

## Environment Configuration

### Replit Port Mapping
In Replit, ports are mapped as follows:
- `localhost:8081` → External port 80 (Expo)
- `localhost:8082` → External port 3000 (Backend)

### Backend URL
The client code automatically detects the environment:
- **Development (Replit)**: `https://{replit-domain}:3000`
- **Local**: `http://localhost:3000`

This is handled by the `getBackendUrl()` function in:
- `services/wallet.service.ts`
- `screens/EventDetailScreen.tsx`

## Testing the Backend

### Health Check
```bash
curl https://{your-replit-domain}:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "Backend server is running"
}
```

### Create Consent (Example)
```bash
curl -X POST https://{your-replit-domain}:3000/api/blinkpay/consent/create \
  -H "Content-Type: application/json" \
  -d '{"redirectUri": "split://blinkpay/callback"}'
```

## Database Migration

Before testing BlinkPay features, **you must run the database migration**:

1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Copy the SQL from `UPDATE_WALLETS_FOR_BLINKPAY.md`
4. Execute the SQL

This adds the necessary columns to track BlinkPay consent information:
- `blinkpay_consent_id`
- `blinkpay_consent_status`
- `blinkpay_consent_expires_at`

## Troubleshooting

### Backend Server Not Starting
**Symptom:** Cannot connect to backend API  
**Solution:**
1. Check if port 8082 is available: `lsof -i :8082`
2. Check server logs for errors
3. Ensure `BLINKPAY_CLIENT_ID` and `BLINKPAY_CLIENT_SECRET` secrets are set

### Module Resolution Errors
**Symptom:** `Unable to resolve module path`  
**Solution:** This error should no longer occur since we removed the BlinkPay SDK from client code. If you see it:
1. Clear Metro bundler cache: `npx expo start -c`
2. Ensure `services/blinkpay.service.ts` doesn't exist in client code

### CORS Errors
**Symptom:** Fetch requests blocked by CORS  
**Solution:** The backend has CORS enabled globally. If issues persist:
1. Check backend server logs
2. Verify the backend URL is correctly set in client code

### Payment Timeout
**Symptom:** Payment takes longer than 30 seconds  
**Solution:** BlinkPay sandbox payments usually complete in 2-5 seconds. If timing out:
1. Check BlinkPay sandbox status
2. Verify consent is active and not expired
3. Check backend server logs for errors

## Next Steps

1. **Run the Database Migration** (see `UPDATE_WALLETS_FOR_BLINKPAY.md`)
2. **Start Both Servers** (backend + Expo)
3. **Test Bank Connection Flow:**
   - Open app in Expo Go
   - Navigate to Wallet tab
   - Click "Connect Bank Account"
   - Complete OAuth flow
   - Verify bank details displayed
4. **Test Payment Flow:**
   - Create a split event
   - Accept the split
   - Click "Pay" button
   - Verify payment processes instantly

## Production Deployment

For production:
1. Deploy the Express backend to a hosting service (Heroku, Railway, etc.)
2. Update `BACKEND_URL` to point to production backend
3. Switch BlinkPay credentials from sandbox to production
4. Ensure proper environment variable management

---

**Backend Integration Complete!**  
The BlinkPay SDK now runs properly in a Node.js backend, and the React Native app communicates with it via REST APIs.
