# Spline - App Store Review Notes

## Demo Account Credentials

### Account 1 (Primary)
- **Email:** account1@gmail.com
- **Password:** account2213
- **Unique ID:** 7742941558
- **Name:** Demo Account One

### Account 2 (For testing friend features)
- **Email:** account2@gmail.com
- **Password:** account2213
- **Unique ID:** 4716306667
- **Name:** Demo Account Two

Both accounts have:
- $100 starting balance for testing payments
- Test mode enabled (uses Stripe test environment)
- No real money is processed
- Already added as friends for easy testing

---

## Testing Payment Features

### Adding a Payment Card
These demo accounts use **Stripe Test Mode**. Use these test card numbers:

| Card Type | Number | Expiry | CVC |
|-----------|--------|--------|-----|
| Visa (Success) | 4242 4242 4242 4242 | Any future date | Any 3 digits |
| Visa (Decline) | 4000 0000 0000 0002 | Any future date | Any 3 digits |
| Mastercard | 5555 5555 5555 4444 | Any future date | Any 3 digits |

**Steps to add a card:**
1. Log in with a demo account
2. Go to Profile tab
3. Tap "Wallet"
4. Tap "Add Payment Card"
5. Enter test card number: `4242 4242 4242 4242`
6. Enter any future expiry date (e.g., 12/28)
7. Enter any 3-digit CVC (e.g., 123)
8. Complete the setup

---

## App Features to Test

### 1. Bill Splitting
- Create a new split from the Home tab
- Select friends to split with
- Enter amount and description
- Friends receive notification to pay

### 2. Wallet & Payments
- View wallet balance
- Add/remove payment cards (test cards only)
- Pay split requests
- Request withdrawals

### 3. Friends Management
- Add friends using their unique ID
- Accept/decline friend requests
- View friend list

### 4. Withdrawals
- Request withdrawal to linked bank account
- Fast transfer (3.5% fee) or Normal transfer (free)
- Note: Withdrawals are manually processed

---

## Important Notes

1. **Test Mode Architecture:** Demo accounts are configured with `stripe_test_mode = true` in their wallet settings. This flag is read server-side to determine which Stripe environment to use. Test mode users interact with Stripe's test environment exclusively. No real charges will occur.

2. **NZ Currency:** All amounts are in New Zealand Dollars (NZD).

3. **Bank Withdrawals:** The withdrawal feature sends a request to our team for manual processing. For testing, you can observe the request is created successfully.

4. **Push Notifications:** Push notifications work on physical devices through Expo Go. The web version shows in-app notifications only.

5. **Security:** All Stripe payment operations require server-side authentication. The test mode flag is controlled server-side only and cannot be manipulated by clients.

---

## Support

- **Website:** https://splinepay.replit.app
- **Privacy Policy:** https://splinepay.replit.app/privacy
- **Terms of Service:** https://splinepay.replit.app/terms
