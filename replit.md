# Split Payment App

## Overview

Split is a React Native mobile application built with Expo that enables users to split bills and manage shared expenses with friends. The app features a comprehensive onboarding flow, friend management system, bill splitting capabilities, and an integrated wallet for managing payments. It's designed to work across iOS, Android, and web platforms.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (November 2025)

### Database Query Fix - Split Participants Infinite Recursion
**Issue**: App was crashing on signup/login with "infinite recursion detected in policy for relation split_participants" error.

**Root Cause**: The `getSplits()` query in `SplitsService` was creating a circular reference:
- Query from `split_participants` → join to `split_events` → join back to `split_participants` (circular!)
- This triggered the RLS policy to check itself recursively, causing infinite recursion

**Solution**: Split the query into two sequential queries:
1. First query: Get `split_event_ids` where user is a participant
2. Second query: Get full split events data using those IDs
3. This avoids the circular reference while achieving the same result

**Files Modified**:
- `services/splits.service.ts` - Updated `getSplits()` method

### Backend Server Architecture for BlinkPay
**Issue**: BlinkPay Node.js SDK incompatible with React Native (requires Node.js-specific modules)

**Solution**: Created Express backend server to handle BlinkPay operations:
- Backend runs on port 8082 (external port 3000 in Replit)
- Expo dev server runs on port 8081 (external port 80)
- Client apps make HTTP requests to backend APIs
- Backend handles all BlinkPay SDK interactions

**Files Added**:
- `server/index.ts` - Express server entry point
- `server/routes/blinkpay.routes.ts` - BlinkPay API endpoints
- `server/services/blinkpay.service.ts` - BlinkPay SDK wrapper
- `start-all.sh` - Script to run both servers
- `BLINKPAY_BACKEND_SETUP.md` - Complete documentation

**Files Modified**:
- `services/wallet.service.ts` - Updated to call backend APIs
- `screens/EventDetailScreen.tsx` - Updated to call backend APIs for payments

## System Architecture

### Frontend Framework
- **React Native with Expo SDK 54**: Cross-platform mobile development framework
- **React 19.1.0**: Latest React version with new compiler features enabled
- **TypeScript**: Type-safe development with strict mode enabled
- **Expo Router**: File-based navigation (not currently used, but available)

### Backend Architecture (New)
- **Express Server**: Handles BlinkPay payment processing
- **Port Configuration**: Backend on 8082 (ext: 3000), Expo on 8081 (ext: 80)
- **API Endpoints**: RESTful APIs for consent creation, payment processing
- **Security**: BlinkPay credentials stored server-side only

### Navigation Architecture
- **React Navigation**: Stack and tab-based navigation
  - Bottom tab navigator with 4 main tabs (Home, Friends, Wallet, Profile)
  - Custom tab bar component with blur effects (iOS) and fallback styling (Android/Web)
  - **Centered Split Button**: Custom tab bar with centered + button for creating splits
    - Two-step navigation pattern: First navigate to HomeTab, then use requestAnimationFrame to open modal
    - Works reliably from any tab without race conditions
    - Includes haptic feedback with error handling
  - Stack navigators nested within each tab for screen hierarchies
  - Modal presentations for certain flows (notifications, split creation)
- **Screen Organization**:
  - Auth flow: Multi-step signup wizard (8 steps) and login
  - Main app: Tab-based navigation with nested stacks
  - Split creation via centered tab bar button (no floating FAB)

### UI/UX Architecture
- **Theming System**: 
  - Centralized theme constants with light/dark mode support
  - Custom hooks (`useTheme`, `useColorScheme`) for consistent styling
  - Elevation-based background colors for depth perception
- **Design Tokens**:
  - Spacing scale (xs to 3xl)
  - Typography system (hero, h1-h4, body, small, caption)
  - Border radius constants
  - Consistent color palette with semantic naming
- **Component Library**:
  - Themed components (ThemedText, ThemedView) that adapt to color scheme
  - Reusable screen wrappers (ScreenScrollView, ScreenKeyboardAwareScrollView, ScreenFlatList)
  - Animated components using Reanimated 4.1.1 for smooth interactions
  - Safe area handling throughout the app

### Authentication & User Management
- **Auth Pattern**: Context-based authentication with React Context API
- **Storage**: AsyncStorage for local data persistence (all data stored client-side)
- **User Model**: Comprehensive user profile including:
  - Basic info (name, email, password, phone, DOB, bio)
  - Unique 6-10 digit ID for friend connections
  - Profile picture support
- **Onboarding**: 8-step wizard collecting user information progressively
- **Security**: PIN-based friend connections, password strength validation

### Data Management
- **Backend**: Supabase PostgreSQL database for real-time data sync
- **Service Layer**: Centralized service classes for API interactions:
  - `AuthService`: User authentication and registration
  - `SplitsService`: Split event creation and management
  - `WalletService`: Balance, transactions, bank connections
  - `BlinkPayService`: Payment processing integration (server-side)
- **Data Models**:
  - Users: Full profile information with Supabase Auth integration
  - Friends: Connection list with unique IDs
  - Split Events: Bill details, participants, amounts, status tracking
  - Wallet: Balance, transactions, BlinkPay consent tracking
  - Notifications: Event-based notifications for split requests
- **RLS Policies**: Row-level security for data access control
- **Query Optimization**: Fixed circular references to prevent infinite recursion
- **Real-time Sync**: Cross-device data synchronization via Supabase

### State Management
- **Local State**: React hooks (useState, useEffect) for component-level state
- **Context API**: Authentication context for global user state
- **Real-time Updates**: Polling mechanism (3-second intervals) for data refresh
- **Pull-to-Refresh**: Manual refresh capability on list screens

### Split Payment Features
- **Split Types**:
  - Equal split: Divide total equally among participants
  - Specified amounts: Custom amounts per participant
- **Creation Flow** (Updated November 2025):
  1. **Type Selection First**: User clicks centered '+' button to open modal with split type options
  2. **Friend Selection**: Choose friends from connections based on selected split type
  3. **Event Details**: Enter event name, total amount, and optional receipt image
  4. **Review & Create**: Finalize split with selected participants
- **Status Tracking**: Pending, paid, declined states per participant
- **Settlement**: Wallet-based payment system
- **Navigation**: Defensive guards prevent crashes from missing parameters during navigation

### Wallet System & Payment Processing
- **Balance Management**: Track available funds
  - Wallet balance displayed in dedicated Wallet tab
  - **Add Funds**: Quick action button in Wallet screen for depositing money
  - Persisted in Supabase database
  - **Withdraw functionality**: Disabled for BlinkPay-connected accounts (funds remain in wallet)
- **Transaction History**: Deposits, payments, transfers tracked in database
- **BlinkPay Integration** (November 2025):
  - **Bank Connection**: OAuth-based connection via BlinkPay Gateway
  - **Enduring Consent**: One-time authorization for future payments without re-auth
  - **Direct Debit**: Payments processed directly from user's bank account
  - **Required for Payments**: Users must connect bank via BlinkPay to pay splits
  - **Credentials**: Stored as Replit secrets (BLINKPAY_CLIENT_ID, BLINKPAY_CLIENT_SECRET)
  - **Sandbox Environment**: Using BlinkPay sandbox for testing
  - **Backend Processing**: All BlinkPay operations handled by Express backend
- **Payment Flow**:
  1. User clicks "Connect Bank" in Wallet screen
  2. Opens BlinkPay OAuth in browser (WebBrowser.openAuthSessionAsync)
  3. User authorizes enduring consent at their bank
  4. Consent ID stored in wallet for future payments
  5. Split payments use stored consent for seamless transactions
- **Home Screen**: Available Funds card removed per user request (November 2025)

### Media Handling
- **Image Picker**: expo-image-picker for profile pictures and receipts
- **Platform-Specific**: Different implementations for iOS/Android vs web
- **Permissions**: Runtime permission requests for camera roll access
- **Image Optimization**: Quality compression (0.8) and aspect ratio enforcement

### Error Handling
- **Error Boundaries**: Class-based error boundary component
- **Fallback UI**: Custom error fallback with restart capability
- **Development Tools**: Detailed error modal in DEV mode with stack traces
- **Graceful Degradation**: Safe fallbacks for missing features (e.g., KeyboardAwareScrollView on web)

### Platform-Specific Considerations
- **iOS**: Blur effects, translucent headers, haptic feedback
- **Android**: Edge-to-edge display, material design adaptations
- **Web**: Fallback components for native-only APIs, responsive design
- **Replit Integration**: Custom dev scripts with environment variable handling

### Accessibility & UX Polish
- **Keyboard Handling**: react-native-keyboard-controller for smooth keyboard interactions
- **Safe Areas**: Universal safe area insets handling
- **Gesture Support**: react-native-gesture-handler for native gestures
- **Haptic Feedback**: Platform-specific tactile feedback (iOS)
- **Loading States**: Activity indicators during async operations
- **Copy-to-Clipboard**: Share unique IDs easily

### Code Organization
- **Path Aliases**: `@/` alias pointing to project root for clean imports
- **Component Structure**: Separation of UI components, screens, and navigation
- **Utility Functions**: Centralized storage service and ID generation
- **Type Safety**: TypeScript interfaces for all data models
- **Constants**: Centralized theme and design token constants

## External Dependencies

### UI & Styling
- **@expo/vector-icons**: Feather icon set for consistent iconography
- **expo-blur**: Native blur effects for iOS
- **expo-glass-effect**: Advanced material effects (liquid glass API check)
- **react-native-reanimated**: High-performance animations
- **react-native-safe-area-context**: Safe area management

### Navigation
- **@react-navigation/native**: Core navigation library
- **@react-navigation/native-stack**: Native stack navigator
- **@react-navigation/bottom-tabs**: Tab-based navigation
- **@react-navigation/elements**: Shared navigation elements
- **react-native-screens**: Native screen optimization
- **react-native-gesture-handler**: Gesture system for navigation

### Input & Interaction
- **react-native-keyboard-controller**: Advanced keyboard handling
- **@react-native-community/datetimepicker**: Native date/time picker
- **expo-haptics**: Tactile feedback

### Media & Utilities
- **expo-image**: Optimized image component
- **expo-image-picker**: Camera roll and camera access
- **expo-clipboard**: Clipboard operations
- **expo-web-browser**: In-app browser for external links

### Storage & Backend
- **@react-native-async-storage/async-storage**: Persistent key-value storage
- **@supabase/supabase-js**: Supabase client for database and auth
- **express**: Backend server framework
- **cors**: Cross-origin resource sharing for backend
- **dotenv**: Environment variable management
- **blink-debit-api-client-node**: BlinkPay payment processing SDK (server-side only)

### Development Tools
- **babel-plugin-module-resolver**: Path alias support
- **eslint-config-expo**: Expo-specific linting rules
- **prettier**: Code formatting
- **TypeScript**: Static type checking
- **nodemon**: Auto-restart backend server on changes
- **ts-node**: TypeScript execution for backend
- **concurrently**: Run multiple servers simultaneously

### Platform Support
- **react-native-web**: Web platform rendering
- **expo-linking**: Deep linking and URL schemes
- **expo-splash-screen**: Native splash screen
- **expo-status-bar**: Status bar customization
- **expo-system-ui**: System UI configuration

## Known Issues & Fixes

### Fixed: Infinite Recursion in RLS Policies (November 2025)
- **Error**: `42P17: infinite recursion detected in policy for relation "split_participants"`
- **Fix**: Modified `getSplits()` query to avoid circular reference
- **Status**: ✅ Resolved

### Fixed: BlinkPay SDK Incompatibility (November 2025)
- **Error**: `Unable to resolve module path` when importing BlinkPay SDK
- **Fix**: Created Express backend server to handle BlinkPay operations
- **Status**: ✅ Resolved
