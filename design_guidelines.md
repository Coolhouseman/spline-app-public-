# Professional Split Payment App - Design Guidelines

## Authentication Architecture

**Auth Required**: Yes - Multi-user financial app with secure backend sync

**Implementation**:
- Email/password signup with professional multi-step wizard
- Collect: first name, last name, email, password (with strength requirements), phone number (SMS verification), date of birth, profile picture
- Generate secure 6-digit numeric user PIN for friend connections
- Prominent privacy policy and terms of service links
- Mock bank connection flow (Plaid-style) for prototype
- Two-factor authentication option in settings
- Account settings include logout and delete account with security confirmations

## Navigation Structure

**Root Navigation**: Tab Bar (4 tabs with floating action button)

**Tabs**:
1. Home - Payment activity dashboard
2. Friends - Connection management
3. [FAB] - New Split (positioned center above tab bar)
4. Wallet - Balance and transfers
5. Profile - Account and settings

## Screen Specifications

### Onboarding Wizard
**Layout**: Professional multi-step form
- Clean header with "Create Account" title and step indicator (1/6)
- Each step in a white card with subtle shadow
- Blue progress bar at top
- Primary action button below card
- Back button in header for steps 2+

**Steps**: Name → Email → Password → Phone (with SMS code) → Date of Birth → Profile Picture

**Completion**: Display user PIN prominently with "Share this PIN to connect with friends" explanation

### Home Screen
**Layout**:
- Default navigation header with "Activity" title
- Notification bell icon (header-right) with red badge
- Search bar below header
- Segmented control: Active | Completed
- ScrollView with professional payment cards

**Payment Card**:
- White background, 16px border radius, subtle shadow
- Event name (18pt semibold)
- Initiator avatar (40px) with name
- Amount display (bold, primary blue)
- Progress indicator (if active)
- Participant count badge
- Timestamp (12pt, gray)
- Tap reveals detail screen

**Safe Area Insets**: Top: headerHeight + Spacing.xl, Bottom: tabBarHeight + Spacing.xl

### Event Detail Screen
**Layout**:
- Standard header with event name
- Summary card: Total amount, your share, initiator badge
- Receipt image preview (if applicable) - tap to enlarge modal
- Participant list with status badges
- Fixed "Request Payment" button (if initiator) at bottom

**Status Badges**: Paid (green), Pending (blue), Declined (red) - all with rounded corners and clear typography

**Safe Area Insets**: Top: Spacing.xl, Bottom: tabBarHeight + Spacing.xl

### Friends Screen
**Layout**:
- Header with "Friends" title and "Add" button (header-right)
- Search bar (search by name or PIN)
- List of friend cards with avatars, names, PINs
- Empty state: Professional illustration with "Connect friends using their 6-digit PIN"

**Safe Area Insets**: Top: Spacing.xl, Bottom: tabBarHeight + Spacing.xl

### Create Split Flow
**Select Friends**: Multi-select list with checkboxes, search, selected count, Continue in header

**Split Type**: Two professional option cards with icons:
- Equal Split: "Divide evenly among participants"
- Custom: "Specify individual amounts"

**Equal Split Form**: Event name, total amount (large currency input), auto-calculated per-person display, Create button below

**Custom Split Form**: Event name, receipt upload option, amount inputs per participant, Create button below

**Safe Area Insets**: Top: Spacing.xl, Bottom: insets.bottom + Spacing.xl

### Wallet Screen
**Layout**:
- Transparent header with "Wallet" title
- Large balance card (prominent typography, primary blue)
- Two action buttons: Withdraw | Add Funds
- Transaction history list below (icons, descriptions, amounts with +/-)

**Withdrawal Flow**: Modal with bank selection, amount input, processing time display, security confirmation

**Safe Area Insets**: Top: headerHeight + Spacing.xl, Bottom: tabBarHeight + Spacing.xl

### Profile Screen
**Layout**:
- Profile header: Large avatar (120px), name, PIN with copy button, verification badge
- Settings sections: Account, Security, Privacy, Support
- Logout button at bottom (red, destructive style)

**Safe Area Insets**: Top: Spacing.xl, Bottom: tabBarHeight + Spacing.xl

## Design System

### Color Palette (Professional & Trustworthy)
- **Primary**: #2563EB (Trust Blue)
- **Primary Dark**: #1E40AF (Dark Blue)
- **Success**: #10B981 (Green)
- **Warning**: #F59E0B (Orange)
- **Danger**: #EF4444 (Red)
- **Background**: #F8FAFC (Light Blue-Gray)
- **Surface**: #FFFFFF
- **Text Primary**: #0F172A (Dark Slate)
- **Text Secondary**: #64748B (Medium Slate)
- **Border**: #E2E8F0

### Typography
- **Headers**: SF Pro Display Semibold (iOS), Roboto Medium (Android)
- **Body**: SF Pro Text Regular (iOS), Roboto Regular (Android)
- **Amounts**: SF Pro Display Bold (iOS), Roboto Bold (Android)
- **Sizes**: Hero 36pt, H1 24pt, H2 18pt, Body 16pt, Caption 14pt, Small 12pt

### Component Specifications

**Buttons**:
- Primary: Blue background (#2563EB), white text, 10px radius, 52px height
- Secondary: White background, blue border, blue text
- Press state: opacity 0.8
- Disabled: opacity 0.5

**Cards**:
- White background, 16px border radius, padding 20px
- Shadow: shadowOffset {width: 0, height: 2}, shadowOpacity: 0.08, shadowRadius: 8

**Floating Action Button**:
- 60px diameter, primary blue, white plus icon
- Positioned above tab bar center
- Shadow: shadowOffset {width: 0, height: 2}, shadowOpacity: 0.10, shadowRadius: 2

**Input Fields**:
- 52px height, 10px border radius, 1px border (#E2E8F0)
- Focus: 2px blue border
- Currency inputs: Large semibold font, right-aligned

**Avatars**: Small 32px, Medium 48px, Large 72px, Profile 120px - all circular with subtle border

### Required Assets
**Default Avatars** (8 variants): Professional geometric patterns in blue gradient, abstract shapes, minimalist finance icons (dollar sign variations, bank symbols) - all conveying trust and professionalism

**Empty State Illustrations**: Professional line art for no friends, no transactions, no splits - blue color scheme, simple and clean

### Interaction Design
- All touches: 0.8 opacity feedback
- Pull-to-refresh on Home and Wallet
- Haptic feedback on payment confirmations
- Smooth slide-in modals for sensitive actions
- Loading states with skeleton screens
- Success checkmark animations
- Secure action confirmations with face/fingerprint biometrics where applicable

### Accessibility
- 44x44px minimum touch targets
- 4.5:1 color contrast minimum
- Dynamic type support
- Complete VoiceOver labels
- Security announcements for sensitive actions
- Error states with clear messaging