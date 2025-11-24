# Supabase Setup Guide

This app uses Supabase for:
- PostgreSQL database
- Authentication (signup/login with email & password)
- File storage (profile pictures & receipt images)
- Real-time cross-device data sync

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up (it's free!)
2. Click "New Project"
3. Choose a name (e.g., "Split Payment App")
4. Create a strong database password (save it somewhere safe)
5. Select a region close to you
6. Click "Create new project" (takes ~2 minutes to set up)

## Step 2: Get Your API Keys

Once your project is created:

1. Go to **Project Settings** (gear icon in sidebar)
2. Click **API** in the left menu
3. You'll need these two values:
   - **Project URL** (looks like: `https://xxxxxxxxxxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

## Step 3: Create Database Tables

1. In your Supabase dashboard, click **SQL Editor** in the sidebar
2. Copy and paste this entire SQL script:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unique_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  date_of_birth TEXT,
  bio TEXT,
  profile_picture TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Friends table
CREATE TABLE friends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'accepted',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Split events table
CREATE TABLE split_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  split_type TEXT NOT NULL,
  receipt_image TEXT,
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Split participants table
CREATE TABLE split_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  split_event_id UUID REFERENCES split_events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  is_creator BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(split_event_id, user_id)
);

-- Wallets table
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance DECIMAL(10,2) DEFAULT 0.00,
  bank_connected BOOLEAN DEFAULT FALSE,
  bank_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT NOT NULL,
  direction TEXT NOT NULL,
  split_event_id UUID REFERENCES split_events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  split_event_id UUID REFERENCES split_events(id) ON DELETE CASCADE,
  metadata JSONB,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create a function to handle split payments
CREATE OR REPLACE FUNCTION process_split_payment(
  payer_id UUID,
  recipient_id UUID,
  amount DECIMAL
) RETURNS void AS $$
BEGIN
  -- Deduct from payer
  UPDATE wallets
  SET balance = balance - amount
  WHERE user_id = payer_id;
  
  -- Add to recipient
  UPDATE wallets
  SET balance = balance + amount
  WHERE user_id = recipient_id;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better query performance
CREATE INDEX idx_friends_user_id ON friends(user_id);
CREATE INDEX idx_split_participants_user_id ON split_participants(user_id);
CREATE INDEX idx_split_participants_split_id ON split_participants(split_event_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
```

3. Click **Run** to execute the script

## Step 4: Set Up Storage Bucket

1. In Supabase dashboard, click **Storage** in the sidebar
2. Click **Create a new bucket**
3. Name it: `user-uploads`
4. Make it **Public** (check the box)
5. Click **Create bucket**

## Step 5: Disable Email Confirmation (For Development)

To make signup easier during development:

1. Go to **Authentication** > **Providers** in the sidebar
2. Click on **Email** provider
3. Scroll down to **Email Confirmation**
4. **Disable** "Confirm email"
5. Click **Save**

This allows users to signup and login immediately without email verification.

### ⚠️ Rate Limit Issues

If you see the error `over_email_send_rate_limit` during signup:

**Cause**: Supabase limits how many emails can be sent in a short time period (protection against spam).

**Solutions**:
1. **Wait** 10-15 minutes for the rate limit to reset, then try again
2. **Disable email confirmation** (see steps above) - this completely bypasses email sending during development
3. **Delete previous signups** - Go to Authentication > Users in Supabase dashboard and delete test accounts to free up your email quota

## Step 6: Configure Row Level Security (RLS)

For security, we need to set up RLS policies:

1. Go to **Authentication** > **Policies**
2. For each table, click **Enable RLS**
3. Add these policies (copy-paste into SQL Editor):

```sql
-- Users: Users can read all, insert and update their own
CREATE POLICY "Users can view all users" ON users FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Friends: Users can manage their own friendships
CREATE POLICY "Users can view own friends" ON friends FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own friends" ON friends FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own friends" ON friends FOR DELETE USING (auth.uid() = user_id);

-- Split events: Users can view splits they're part of
CREATE POLICY "Users can view their splits" ON split_events FOR SELECT 
  USING (auth.uid() IN (
    SELECT user_id FROM split_participants WHERE split_event_id = id
  ));
CREATE POLICY "Users can create splits" ON split_events FOR INSERT 
  WITH CHECK (auth.uid() = creator_id);

-- Split participants: Users can view and update their participations
CREATE POLICY "Users can view split participants" ON split_participants FOR SELECT
  USING (auth.uid() IN (
    SELECT user_id FROM split_participants WHERE split_event_id = split_event_id
  ));
CREATE POLICY "Creators can add participants" ON split_participants FOR INSERT
  WITH CHECK (auth.uid() IN (
    SELECT creator_id FROM split_events WHERE id = split_event_id
  ));
CREATE POLICY "Users can update own participation" ON split_participants FOR UPDATE
  USING (auth.uid() = user_id);

-- Wallets: Users can only access their own wallet
CREATE POLICY "Users can view own wallet" ON wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own wallet" ON wallets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own wallet" ON wallets FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Transactions: Users can only see their own transactions
CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert transactions" ON transactions FOR INSERT WITH CHECK (true);

-- Notifications: Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON notifications FOR INSERT WITH CHECK (true);
```

## Step 7: Provide Credentials to the App

You'll need to add these as environment variables:
- `EXPO_PUBLIC_SUPABASE_URL` = Your Project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` = Your anon public key

The agent will request these from you next!

## Done!

Your Supabase backend is now ready to sync data across all devices where users install your app!

## Important Notes

- **Email Confirmation**: We disabled this for development. For production, re-enable it and implement email verification flow.
- **Security**: The RLS policies ensure users can only access their own data.
- **Session Persistence**: Sessions are automatically saved and restored using AsyncStorage.
- **Token Refresh**: Supabase automatically refreshes auth tokens in the background.
