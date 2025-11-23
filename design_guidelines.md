# Split Payment App - Design Guidelines

## Authentication Architecture

**Auth Required**: Yes - Multi-user social payment app with backend data sync

**Implementation**:
- Custom email/password signup (per user's Typeform-style requirement)
- Multi-step onboarding wizard collecting: first name, last name, email, password, phone number, date of birth (native date picker), profile picture upload, user bio
- Auto-generate 5-10 digit numeric unique ID upon account creation (display to user after signup)
- Include privacy policy and terms of service links on signup screen
- Mock Blinkpay bank connection flow for prototype
- Account settings must include logout and delete account options

## Navigation Structure

**Root Navigation**: Tab Bar (4 tabs with floating action button)

Tabs:
1. **Home** - Dashboard of split activities
2. **Friends** - Friend management
3. **[Floating Action Button]** - Create Split Event (positioned above tab bar center)
4. **Wallet** - Balance and withdrawals
5. **Profile** - User account and settings

**Navigation Stacks**:
- Home Stack: Home → Event Detail
- Friends Stack: Friends List → Add Friend
- Create Stack: Select Friends → Split Type → Event Details → Receipt Upload (if specified)
- Wallet Stack: Wallet → Withdrawal Options → Bank Connection
- Profile Stack: Profile → Settings → Account Management

**Modal Screens**:
- Notification panel (slide-in from top)
- Image zoom view (receipt enlargement)
- Confirmation alerts (payment acceptance, withdrawal confirmation)

## Screen Specifications

### 1. Onboarding Flow (Stack-Only, No Tab Bar)

**Typeform-Style Signup Screens** (one field per screen):
- Each screen features one primary input centered vertically
- Transparent header with progress indicator (step X of 8)
- "Continue" button fixed at bottom (above safe area)
- Back button in top-left corner (except first screen)
- Smooth transitions between steps

**Safe Area Insets**: 
- Top: insets.top + Spacing.xl
- Bottom: insets.bottom + Spacing.xl

**Screens in order**:
1. First Name
2. Last Name  
3. Email Address
4. Password (with strength indicator)
5. Phone Number (with country code picker)
6. Date of Birth (native iOS roller/Android date picker)
7. Profile Picture Upload (camera or gallery options)
8. User Bio (multiline text input, 200 char limit)

**Completion Screen**:
- Display generated unique ID prominently
- "Copy ID" button
- Explanation: "Share this ID with friends to connect"
- "Get Started" button navigates to main app

### 2. Home Screen

**Purpose**: Dashboard showing all split activities

**Layout**:
- Transparent header with "Split" title centered
- Notification bell icon in top-right (with badge count)
- Search bar below header (filter by event name)
- Segmented control: "In Progress" | "Completed"
- ScrollView with activity cards

**Activity Card Design**:
- Event name (bold, 18pt)
- Initiator profile picture (small circular avatar)
- Total amount and your share
- Progress bar (for in-progress only)
- Participant count indicator
- Timestamp
- Card has subtle shadow, rounded corners (12px)

**Safe Area Insets**: 
- Top: headerHeight + Spacing.xl
- Bottom: tabBarHeight + Spacing.xl

### 3. Event Detail Screen

**Purpose**: View all participants and payment statuses

**Layout**:
- Custom header with event name as title
- "Initiator" badge clearly displayed below event name
- Total amount and progress summary at top
- Receipt image (if specified split) - tappable to enlarge
- Participant list (scrollable)
- Each participant shows: profile picture (medium), full name, status badge

**Status Badge Colors**:
- Paid: Green background, white text
- Pending: Orange background, white text
- Declined: Red background, white text

**Safe Area Insets**: 
- Top: Spacing.xl (non-transparent header)
- Bottom: tabBarHeight + Spacing.xl

### 4. Friends Screen

**Purpose**: Manage friend connections

**Layout**:
- Default navigation header with "Friends" title
- Search bar (search by name or ID)
- "Add Friend" button in header-right (plus icon)
- FlatList of friend cards
- Empty state: "Add friends using their unique ID"

**Friend Card**:
- Profile picture (medium, circular)
- Full name
- Unique ID displayed below name
- Subtle divider between cards

**Add Friend Modal**:
- Text input for numeric ID
- "Add Friend" button (disabled until valid ID entered)
- Validation: 5-10 digits only

**Safe Area Insets**: 
- Top: Spacing.xl (standard header)
- Bottom: tabBarHeight + Spacing.xl

### 5. Create Split Event Flow

**Screen 1: Select Friends**
- Multi-select list with checkboxes
- Friend search at top
- "Continue" button in header-right (enabled when ≥1 selected)
- Selected count indicator

**Screen 2: Split Type**
- Two large option cards: "Equal Split" | "Specified"
- Icon + description for each
- Tapping card proceeds to next step

**Screen 3a: Equal Split**
- Event name input (required)
- Total amount input (currency formatted)
- Auto-calculated share displayed per person
- "Create Event" button below form

**Screen 3b: Specified Split**
- Event name input (required)
- "Upload Receipt" photo picker
- Receipt preview (tappable to zoom)
- "What is your share?" amount input
- Remaining amount display
- "Create Event" button below form

**Safe Area Insets**: 
- Top: Spacing.xl (standard headers)
- Bottom: insets.bottom + Spacing.xl (no tab bar in flow)

### 6. Notification Panel

**Layout**:
- Slide-down modal from top
- Semi-transparent backdrop
- White panel with rounded bottom corners
- List of pending invitations
- Each notification shows: event name, initiator name, amount
- Two action buttons: "Accept" (primary) | "Decline" (secondary)

### 7. Wallet Screen

**Purpose**: View balance and withdraw funds

**Layout**:
- Transparent header with "Wallet" title
- Large balance display at top (prominent typography)
- "Transfer" and "Withdraw" buttons side-by-side
- Transaction history list below
- Each transaction: icon, description, amount (+ or -), date

**Withdrawal Modal**:
- Two option cards: "Instant" | "Standard"
- Instant: "2% fee • Arrives in minutes"
- Standard: "Free • Arrives in 3-4 days"
- Amount input field
- "Connect Bank Account" button (if not connected)
- "Withdraw" button (if bank connected)

**Safe Area Insets**: 
- Top: headerHeight + Spacing.xl
- Bottom: tabBarHeight + Spacing.xl

### 8. Profile Screen

**Layout**:
- Profile header: large avatar, name, unique ID (with copy button)
- Edit profile button
- Settings list: Account, Notifications, Privacy, Help
- Logout button at bottom (destructive style)

**Safe Area Insets**: 
- Top: Spacing.xl (standard header)
- Bottom: tabBarHeight + Spacing.xl

## Design System

### Color Palette
- **Primary**: #00A86B (Green - payment/money theme)
- **Secondary**: #5B47E5 (Purple - accents)
- **Success**: #10B981 (Paid status)
- **Warning**: #F59E0B (Pending status)
- **Danger**: #EF4444 (Declined status)
- **Background**: #F9FAFB (Light gray)
- **Surface**: #FFFFFF (Cards, modals)
- **Text Primary**: #111827
- **Text Secondary**: #6B7280
- **Border**: #E5E7EB

### Typography
- **Headers**: SF Pro Display Bold (iOS), Roboto Bold (Android)
- **Body**: SF Pro Text Regular (iOS), Roboto Regular (Android)
- **Sizes**: 
  - Hero: 32pt (Balance display)
  - H1: 24pt (Screen titles)
  - H2: 18pt (Card titles)
  - Body: 16pt (Standard text)
  - Caption: 14pt (Secondary info)
  - Small: 12pt (Timestamps, hints)

### Spacing Scale
- xs: 4px
- sm: 8px
- md: 12px
- lg: 16px
- xl: 24px
- 2xl: 32px

### Component Specifications

**Buttons**:
- Primary: Green background, white text, rounded 8px, height 48px
- Secondary: White background, green border, green text
- All buttons have active state opacity 0.7
- Disabled state opacity 0.4

**Cards**:
- Background: white
- Border radius: 12px
- Padding: 16px
- Shadow: shadowOffset {width: 0, height: 2}, shadowOpacity: 0.10, shadowRadius: 4

**Floating Action Button**:
- Circular, 56px diameter
- Primary green color
- White plus icon
- Positioned above tab bar center
- Shadow: shadowOffset {width: 0, height: 2}, shadowOpacity: 0.10, shadowRadius: 2

**Progress Bar**:
- Height: 8px
- Background: #E5E7EB
- Fill: Primary green
- Rounded ends
- Animated transitions

**Input Fields**:
- Height: 48px
- Border: 1px solid #E5E7EB
- Rounded: 8px
- Focus state: Primary green border
- Padding: 12px horizontal

**Avatar Sizes**:
- Small: 32px
- Medium: 48px
- Large: 80px
- Profile Header: 120px

### Required Assets
1. **Default Profile Avatars** (8-10 variants):
   - Geometric abstract patterns in app color scheme
   - Minimalist money/finance themed icons
   - Gender-neutral designs
2. **Empty State Illustrations**:
   - No friends yet illustration
   - No transactions illustration
   - No pending splits illustration

### Interaction Design
- All touchable elements have 0.7 opacity on press
- Swipe gestures: Swipe notification cards to dismiss
- Pull-to-refresh on Home and Wallet screens
- Haptic feedback on payment acceptance/decline
- Loading states for all async operations
- Success animations after completing payment or withdrawal

### Accessibility
- Minimum touch target: 44x44px
- Color contrast ratio: 4.5:1 minimum
- Dynamic type support
- VoiceOver labels on all interactive elements
- Status announcements for payment updates
- Alternative text for all icons