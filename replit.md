# Spline Payment App

## Overview

Spline is a React Native mobile application built with Expo, designed to facilitate bill splitting and shared expense management among friends across iOS, Android, and web platforms. The app integrates a comprehensive onboarding process, friend management, flexible bill splitting functionalities, and an integrated wallet system for payment processing. Its core purpose is to simplify shared financial interactions, offering a seamless and efficient user experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Framework
- **React Native with Expo SDK 54**: Cross-platform development using TypeScript with strict mode.
- **React 19.1.0**: Utilizes the latest React version.

### Backend Architecture
- **Express Server**: 
  - Development: Runs on port 8082 (via dev script)
  - Production: Runs on port 8081 (Autoscale deployment)
- **Expo Dev Server**: Runs on port 8081 for mobile app development.
- **Stripe Integration**: Credit/debit card payments for deposits and split payments
- **Stripe Routes**: `server/routes/stripe.routes.ts` - customer creation, SetupIntent, PaymentIntent, card management
- **Card Setup Page**: `server/public/card-setup.html` - Hosted Stripe Elements form for secure card binding

### Public Website (splinepay.replit.app)
- **Landing Page**: Professional marketing page at `/` with features, security info, and download CTAs
- **Terms and Conditions**: Legal terms at `/terms`
- **Privacy Policy**: Data protection policy at `/privacy`
- **Admin Access**: Hidden gear icon in footer links to `/admin` dashboard
- **Files Location**: `server/public/index.html`, `server/public/terms.html`, `server/public/privacy.html`
- **Development Note**: During development, Replit webview shows Expo app. After publishing, splinepay.replit.app shows the landing page.

### UI/UX Architecture
- **Theming System**: Centralized theme constants with light/dark mode support and custom hooks (`useTheme`, `useColorScheme`).
- **Design Tokens**: Standardized spacing, typography, border radius, and a semantic color palette.
- **Component Library**: Reusable, themed components and screen wrappers, including animated components with Reanimated 4.1.1.
- **Navigation**: Uses React Navigation for stack and tab-based navigation, featuring a custom bottom tab bar with a centered split creation button.

### Authentication & User Management
- **Auth Pattern**: Context-based authentication using React Context API.
- **Storage**: AsyncStorage for local data persistence.
- **User Model**: Comprehensive user profiles with unique IDs and profile picture support.
- **Onboarding**: An 8-step wizard for user information collection.
- **Terms Acceptance**: Users must accept Terms and Conditions and Privacy Policy during signup (Step 4 - Password screen).

### Legal Documents
- **Terms and Conditions**: Comprehensive terms for KNH Group (screens/TermsScreen.tsx)
- **Privacy Policy**: Data protection and privacy information (screens/PrivacyPolicyScreen.tsx)
- **Company Contact**: admin@spline.nz
- **Location**: New Zealand
- **Presentation**: Modal screens accessible from AuthStackNavigator during signup or from profile settings.

### Data Management
- **Backend**: Supabase PostgreSQL for real-time data synchronization.
- **Service Layer**: Centralized services for Auth, Splits, Wallet, and BlinkPay interactions.
- **Data Models**: Includes Users, Friends, Split Events, Wallet, and Notifications.
- **RLS Policies**: Row-level security for data access control.

### State Management
- **Local State**: React hooks for component-level state.
- **Context API**: Global user state management.
- **Real-time Updates**: Polling mechanism and pull-to-refresh for data synchronization.

### Friend Management
- **Friend Requests**: Send requests by entering the recipient's unique_id (5-10 digit numeric ID)
- **Friends Screen Sections**:
  1. **Friend Requests** (incoming) - Requests from other users with Accept/Decline buttons
  2. **Sent Requests** (outgoing) - Requests you've sent, displayed with a "Pending" badge
  3. **Your Friends** - Accepted friendships
- **Cooldown Period**: 24-hour cooldown between sending reminders for pending requests
- **User Lookup**: Users are found by their unique_id

### Split Payment Features
- **Split Types**: Supports equal and specified amount splitting.
- **Creation Flow**: User selects split type, chooses friends, enters event details, and finalizes the split.
- **Status Tracking**: Tracks pending, accepted, paid, and declined states for participants.
- **Visibility Rules**: 
  - Creators always see their splits
  - Invited participants see splits with status: accepted or paid (pending/declined are hidden from main list)
  - Users receive notification invites for pending splits and must accept to see them in their list
- **Settlement**: Wallet-based payment system.

### Wallet System & Payment Processing
- **Balance Management**: Tracks available funds, persisted in Supabase.
- **Stripe Integration**: Users add a credit/debit card once for one-tap payments. Card details securely stored via Stripe.
- **Payment Flow**: 
  1. Users add a payment card via Stripe Elements (hosted card-setup.html page)
  2. Card is saved as a PaymentMethod for off-session charges
  3. Split payments first deduct from wallet balance, then charge card for shortfall
- **Database Fields**: `stripe_customer_id`, `stripe_payment_method_id`, `card_brand`, `card_last4` in wallets table
- **Creator Wallet Credits**: When a participant pays their share, the creator's wallet is credited via the `credit_recipient_wallet` RPC function. The creator's own share (auto-marked as 'paid' at creation) is NOT credited to their wallet.
- **Withdrawal Types**:
  - **Fast Transfer**: 2% fee INCLUDED in withdrawal amount (not added on top). User enters $14, fee of $0.28 is deducted, user receives $13.72 in bank. Fee stays with business as revenue.
  - **Normal Transfer**: Free, arrives in 3-5 business days. Standard bank transfer.
- **Withdrawals**: Manual bank transfers - user provides bank account details for each withdrawal request. Admin processes withdrawals manually.
- **Anti-Abuse Mechanism**:
  - 24-hour hold on deposited funds before withdrawal (earned funds from split payments can be withdrawn immediately)
  - Maximum 3 withdrawals per day
  - Prevents fund cycling/money laundering attempts
- **Transaction Metadata**: Withdrawal transactions store type, fee amount, net amount (what user receives), estimated arrival, and status in a JSONB metadata field.
- **Stripe Fees**: Stripe charges ~2.9% + 30c per transaction. This is absorbed by the company - the split creator receives the full amount shown in UI.

### Wallet Race Condition Protection (Atomic RPC Functions)
All wallet balance changes use PostgreSQL RPC functions with `FOR UPDATE` row locks:
- **`process_deposit`**: Atomically adds funds + logs transaction. Creates wallet if needed.
- **`process_withdrawal`**: Atomically deducts funds + logs transaction. Validates sufficient balance.
- **`credit_recipient_wallet`**: Atomically credits split payment recipient + logs transaction. Creates wallet if needed.
- **`log_transaction_rpc`**: Standalone transaction logging with validation.

These functions ensure:
1. Row-level locking prevents concurrent modifications
2. Balance update and transaction log happen together or not at all
3. Automatic rollback on any failure
4. No "half-completed" states possible

### Admin Dashboard
- **Local Development URL**: http://localhost:8082/admin (Express server)
- **Production URL**: https://splinepay.replit.app/admin
- **Deployment**: Express server serves static HTML dashboard
- **API Endpoints**: `/api/admin/*` routes on Express server
- **Authentication**: Supabase Auth with admin_roles table verification
- **Default Admin**: admin@spline.nz (super_admin)
- **Dashboard Tabs**:
  1. **Overview**: Total liabilities, deposits, withdrawals, active wallets, BlinkPay fee tracking, fast withdrawal revenue
  2. **Buffer Analysis**: Cash position vs liabilities, buffer requirements, 7/30 day projections, status indicators
  3. **Transactions**: Full transaction history with filtering by type, pagination, CSV export
  4. **Withdrawals**: Manual withdrawal processing queue with user details, bank info, fee breakdown, status management
  5. **Settings**: Admin user management (super_admin can add/remove admins), fee configuration display
- **Files**: 
  - HTML: `server/public/admin/index.html`
  - Routes: `server/routes/admin.routes.ts`
- **Note**: Supabase Edge Functions cannot serve HTML. Admin dashboard hosted via Express server.

### Withdrawal Email Notifications
- **Trigger**: Automatic email sent when user submits a withdrawal request
- **Recipient**: hzeng1217@gmail.com (admin notification)
- **Content**: User details, withdrawal amount, fees, bank information, estimated arrival, action required
- **Service**: `server/services/email.service.ts` using nodemailer with Gmail SMTP
- **API Endpoint**: POST `/api/notify-withdrawal` (protected by service key)
- **Configuration**: SMTP_USER and SMTP_PASS secrets for Gmail authentication

### Media Handling
- **Image Picker**: Uses `expo-image-picker` for profile pictures and receipts with platform-specific implementations and permission handling.

### Push Notifications (iOS/Android)
- **expo-notifications**: Native push notification support for iOS and Android devices.
- **Permission Flow**: Requests notification permission on first app launch after login. iOS and Android 13+ require explicit user consent.
- **Push Token Storage**: Expo push tokens are stored in the `users` table (`push_token` column).
- **Notification Triggers**:
  1. **Split Invite**: When someone invites you to join a split activity.
  2. **Payment Received**: When someone pays their share to you.
  3. **Split Completed**: When a split reaches 100% (all participants have paid).
  4. **Payment Reminder**: Daily automated reminder for unpaid splits.
- **Badge Count**: App icon badge updates to show unread notification count.
- **Deep Linking**: Tapping a notification navigates to the relevant event detail or notifications screen.
- **Web Fallback**: Push notifications are not supported on web; only in-app notifications work on web platform.

### Daily Payment Reminders
- **Automated Scheduler**: Backend service (server/services/dailyReminder.service.ts) runs hourly and sends reminders at 9 AM daily.
- **Target Users**: Users with pending or accepted split payments (excluding creators who already paid).
- **Notification Types**: Both in-app notifications and push notifications are sent.
- **Message Content**: Personalized reminder showing total amount owed and list of pending splits.
- **Manual Trigger**: POST `/api/reminders/send-now` endpoint to manually trigger reminders for testing.

### Error Handling
- **Error Boundaries**: Class-based error boundary component with fallback UI.
- **Development Tools**: Detailed error modal in DEV mode.

### Platform-Specific Considerations
- Optimized for iOS (blur effects, haptics), Android (material design), and Web (responsive design, fallback components).
- Replit Integration: Custom dev scripts and environment variable handling for Replit hosting.

## External Dependencies

### UI & Styling
- **@expo/vector-icons**: Icon library.
- **expo-blur**: Native blur effects.
- **react-native-reanimated**: Animations library.
- **react-native-safe-area-context**: Safe area management.

### Navigation
- **@react-navigation/native**: Core navigation library.
- **@react-navigation/native-stack**: Stack navigator.
- **@react-navigation/bottom-tabs**: Tab navigator.
- **react-native-screens**: Native screen optimization.
- **react-native-gesture-handler**: Gesture system.

### Input & Interaction
- **react-native-keyboard-controller**: Advanced keyboard handling.
- **expo-haptics**: Tactile feedback.

### Media & Utilities
- **expo-image-picker**: Image and camera access.
- **expo-clipboard**: Clipboard operations.
- **expo-web-browser**: In-app browser.

### Storage & Backend
- **@react-native-async-storage/async-storage**: Persistent local storage.
- **@supabase/supabase-js**: Supabase client for database and auth.
- **express**: Backend server framework.
- **cors**: Cross-origin resource sharing.
- **dotenv**: Environment variable management.
- **stripe**: Stripe Node.js SDK (server-side payment processing).

### Development Tools
- **babel-plugin-module-resolver**: Path alias support.
- **prettier**: Code formatting.
- **TypeScript**: Static type checking.
- **nodemon**: Server auto-restart.
- **concurrently**: Run multiple processes simultaneously.