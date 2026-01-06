# Spline Payment App

## Overview
Spline is a React Native mobile application built with Expo, designed to facilitate bill splitting and shared expense management among friends across iOS, Android, and web platforms. The app integrates a comprehensive onboarding process, friend management, flexible bill splitting functionalities, and an integrated wallet system for payment processing. Its core purpose is to simplify shared financial interactions, offering a seamless and efficient user experience. The project aims to provide a professional marketing presence and robust backend infrastructure for secure and efficient payment handling.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Framework
- **React Native with Expo SDK 54**: Cross-platform development using TypeScript.
- **React 19.1.0**: Latest React version.

### Backend Architecture
- **Express Server**: Handles API routes, Stripe integration, and serves the public website and admin dashboard.
- **Stripe Integration**: Comprehensive payment processing for deposits and split payments.
- **Supabase PostgreSQL**: Real-time data synchronization and persistent storage, including Row-Level Security (RLS) policies.

### Public Website (splinepay.replit.app)
- **Landing Page**: Professional marketing page.
- **Legal Pages**: Terms and Conditions, Privacy Policy.
- **Admin Access**: Hidden link to `/admin` dashboard.

### UI/UX Architecture
- **Theming System**: Centralized theme constants with light/dark mode support and custom hooks.
- **Design Tokens**: Standardized spacing, typography, border radius, and semantic color palette.
- **Component Library**: Reusable, themed components and screen wrappers, including animated components with Reanimated 4.1.1.
- **Navigation**: React Navigation for stack and tab-based navigation with a custom bottom tab bar.

### Authentication & User Management
- **Auth Pattern**: Context-based authentication using React Context API.
- **Supabase Auth**: Handles password storage securely in `auth.users` (not in public schema).
- **Auto-Recovery**: Login flow auto-creates missing user profiles and wallets if user exists in Supabase Auth but not in public.users.
- **Storage**: AsyncStorage for local data persistence.
- **User Model**: Comprehensive user profiles (password column is nullable - auth handled by Supabase).
- **Onboarding**: 8-step wizard for user information collection and terms acceptance.
- **Apple Sign-In**: Only works in TestFlight/production builds. Expo Go returns error "Unacceptable audience in id_token: [host.exp.Exponent]" - this is expected behavior per Apple's security requirements.

### Data Management
- **Service Layer**: Centralized services for Auth, Splits, Wallet, and Stripe interactions.
- **Data Models**: Users, Friends, Split Events, Wallet, and Notifications.
- **State Management**: React hooks for local state, Context API for global state, and polling/pull-to-refresh for real-time updates.

### Friend Management
- **Friend Requests**: Send requests by unique_id (5-10 digit numeric ID).
- **Friend Lists**: Categorized display of incoming, sent, and accepted friend requests.
- **Cooldown Period**: 24-hour cooldown for reminder sending.
- **Realtime Updates**: Supabase Realtime subscription for instant updates when receiving friend requests or when requests are accepted/declined.

### Split Payment Features
- **Split Types**: Equal and specified amount splitting.
- **Creation Flow**: Guided process for selecting friends, event details, and finalizing splits.
- **Status Tracking**: Pending, accepted, paid, and declined states for participants.
- **Visibility Rules**: Dynamic display of splits based on user participation and status.
- **Settlement**: Wallet-based payment system.
- **Realtime Updates**: Supabase Realtime subscriptions for live progress updates.
  - **EventDetailScreen**: Per-split subscription for instant updates when viewing a specific split
  - **MainHomeScreen**: Per-split channels (up to 20 most recent) + always-on invite listener + 60s polling backup
  - **Architecture**: Individual channels per split to avoid Supabase filter size limits (512 bytes)
  - **Delete Functionality**: Split creators can swipe-delete splits from 'In Progress' tab, removing for all participants
  - **Future Enhancement**: For 100% realtime coverage beyond 20 splits, implement a `user_split_events_feed` table with database triggers that fan out changes to all participants, allowing a single user-scoped subscription per client

### Wallet System & Payment Processing
- **Balance Management**: Tracks available funds.
- **Stripe Integration**: Securely adds payment cards for one-tap payments via PaymentMethod tokens.
- **Payment Flow**: Prioritizes wallet deduction, then card charge, with automatic refunds for failed card payments.
- **Creator Wallet Credits**: Creator's wallet credited when participants pay their share.
- **Withdrawal Types**: Fast Transfer (2% fee) and Normal Transfer (free). Manual processing by admin.
- **Anti-Abuse Mechanism**: 
  - **5-day hold on deposited funds**: Users cannot withdraw deposited funds for 5 days after deposit (earned funds from split payments can be withdrawn immediately)
  - **Maximum 2 deposits per day**: Rate limits deposits to prevent rapid fund cycling
  - **Maximum 3 withdrawals per day**: Daily withdrawal limit across all types
  - **4 withdrawals per month per type**: Monthly limit for both fast and normal transfers
- **Atomic RPC Functions**: PostgreSQL RPC functions with `FOR UPDATE` row locks for all wallet balance changes (`process_deposit`, `process_withdrawal`, `process_split_payment`, `credit_recipient_wallet`, `log_transaction_rpc`).

### Stripe Card Binding (PCI Compliant)
- CVV handling via Stripe Elements, PaymentMethod token storage, off-session payments.
- Only card brand and last four digits stored in the database for display.

### Stripe Dual-Mode Architecture (App Store Review)
- **Purpose**: Enables Apple reviewers to test payment features without real charges.
- **Test Mode Flag**: `stripe_test_mode` boolean column in wallets table (admin-controlled only).
- **Demo Accounts**: `account1@gmail.com` and `account2@gmail.com` with test mode enabled.
- **Security**: All Stripe endpoints require Supabase JWT authentication. Test mode is determined server-side only via `userAuthMiddleware`, which reads the wallet's `stripe_test_mode` flag after token verification.
- **Endpoints**: All card setup, charge, and payment method endpoints derive userId from auth token (no client-supplied userId).
- **Public Endpoint**: Only `/api/stripe/publishable-key` is unauthenticated (returns live key for StripeProvider initialization).
- **Files**: `server/routes/stripe.routes.ts`, `services/stripe.service.ts`, `APP_STORE_REVIEW_NOTES.md`.

### Admin Dashboard
- **Access**: `http://localhost:8082/admin` (dev) / `https://splinepay.replit.app/admin` (prod).
- **Authentication**: Supabase Auth with admin_roles verification.
- **Features**: Overview, Buffer Analysis, Transactions, Withdrawals processing, Users & Levels (gamification), Settings (admin user management).
- **Live Updates**: Server-Sent Events (SSE) stream at `/api/admin/stream` broadcasts metrics every 5 seconds. Dashboard auto-updates without manual refresh, with visual "Live" indicator showing connection status.
- **Supabase Client Pattern**: All admin database queries use fresh Supabase clients (created per-request with explicit schema configuration) to avoid connection state issues with the global client. This ensures reliable data fetching across server restarts.
- **Users & Levels Tab**: Displays gamification stats including total XP, average level, active streaks, Balance Momentum tier distribution, level distribution chart, and user leaderboard.

### Withdrawal Email Notifications
- Automatic email to admin (`hzeng1217@gmail.com`) upon user withdrawal request using nodemailer.

### Media Handling
- `expo-image-picker` for profile pictures and receipts.

### Push Notifications (iOS/Android)
- `expo-notifications` for native push notifications.
- **Triggers**: Split invites, payment received, split completed, payment reminders, friend requests.
- **Features**: Badge count, deep linking to relevant screens.
- **Deep Linking Routes** (handled in `hooks/usePushNotifications.ts`):
  - `friend_request` / `friend_accepted` → Friends Tab
  - `split_invite` / `split_accepted` / `split_declined` / `split_paid` / `split_completed` / `payment_received` → EventDetail screen (with splitEventId)
  - `payment_reminder` → Notifications screen
  - Fallback logic based on `splitEventId` or `friendship_id` fields for legacy notifications

### Daily Payment Reminders
- Automated backend service (hourly run, 9 AM daily) for users with pending split payments.
- Sends both in-app and push notifications.

### Gamification / XP System
- **Pure Status-Based**: No monetary rewards, focused on engagement and recognition.
- **Level System**: 50 levels with progressive XP thresholds. Professional titles reflecting trust and status: Member → Verified → Silver → Gold → Platinum → Premier → Select → Private → Elite → Prestige → Chairman.
- **XP Awards**: 
  - Split creation (25-40 XP based on size)
  - Paying splits (20-35 XP based on speed)
  - Completion bonuses for creators (50 XP)
  - Streak bonuses (weekly/monthly)
  - Balance Momentum (10-50 XP/day based on tier)
- **Perks**:
  - Level 10: $50 Dinner Voucher (requires admin approval)
  - Level 15: Extended withdrawal limits
  - Level 20: 10% discount on fast withdrawals
  - Level 25: VIP restaurant partner discounts
  - Level 30: Hotel partner benefits
  - Level 40: Airport lounge access (coming soon)
  - Level 50: Premium concierge service
- **Anti-Abuse Protection**: Prevents XP farming and perk exploitation
  - Minimum $5 split amount required for XP
  - Daily XP cap of 500 from splits
  - Stats still tracked even when XP not awarded
  - Voucher perks require manual admin approval
  - Suspicious activity logged for admin review
- **Badges**: Bronze → Silver → Gold → Platinum tiers for milestones (creator, payer, streak, social).
- **Streak System**: Daily activity tracking with bonus XP at 7 and 30 day milestones.
- **Balance Momentum**: Wallet retention incentive system. Users earn XP for maintaining wallet balances over time.
  - Bronze Tier ($50+ avg balance): 10 XP/day
  - Silver Tier ($200+ avg balance): 25 XP/day
  - Gold Tier ($500+ avg balance): 50 XP/day
  - Based on 7-day rolling average balance, processed daily via `process_all_balance_momentum` RPC
  - Tables: `wallet_balance_history` (daily snapshots), fields on `user_gamification`
- **Graceful Degradation**: Service returns sensible defaults (Level 1, "Member") if gamification tables not available, ensuring core payment flows are never blocked.
- **Migration Requirement**: `GAMIFICATION_MIGRATION.sql` must be applied in Supabase for full functionality. Includes Balance Momentum tables.
- **Components**: `ProfileStatsCard.tsx`, `LevelBadge.tsx`, `LevelUpModal.tsx`, `LevelUpContext.tsx`.
- **Service**: `services/gamification.service.ts` with XP awarding, streak tracking, badge logic, Balance Momentum status.
- **Admin Monitoring**: 
  - `/api/admin/gamification/stats` - Overall stats including momentum tier distribution (both processed and eligible)
  - `/api/admin/gamification/users` - User leaderboard with XP, levels, streaks
  - `/api/admin/gamification/process-balance-momentum` - Manual trigger for momentum processing (backfills history first)
  - `/api/admin/gamification/balance-momentum/stats` - Detailed momentum analytics
  - Admin dashboard "Users & Levels" tab with "Process Momentum" button for manual triggering
- **Future Enhancement**: Add Supabase cron or server-side job to run process_all_balance_momentum() daily at 9 AM

### Error Handling
- Class-based error boundary component with fallback UI.
- Detailed error modal in DEV mode.

### Platform-Specific Considerations
- Optimized for iOS, Android, and Web, with Replit integration for development.

## External Dependencies

### UI & Styling
- `@expo/vector-icons`
- `expo-blur`
- `react-native-reanimated`
- `react-native-safe-area-context`

### Navigation
- `@react-navigation/native`
- `@react-navigation/native-stack`
- `@react-navigation/bottom-tabs`
- `react-native-screens`
- `react-native-gesture-handler`

### Input & Interaction
- `react-native-keyboard-controller`
- `expo-haptics`

### Media & Utilities
- `expo-image-picker`
- `expo-clipboard`
- `expo-web-browser`
- `expo-notifications`

### Storage & Backend
- `@react-native-async-storage/async-storage`
- `@supabase/supabase-js`
- `express`
- `cors`
- `dotenv`
- `stripe` (Node.js SDK)
- `nodemailer`

### Development Tools
- `babel-plugin-module-resolver`
- `prettier`
- `TypeScript`
- `nodemon`
- `concurrently`