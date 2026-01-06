-- ============================================================
-- CONSOLIDATED RLS FIX - Run this ONCE to fix all policy issues
-- This replaces ALL previous RLS fix files
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- =====================================================
-- STEP 1: DROP ALL EXISTING HELPER FUNCTIONS
-- =====================================================
DROP FUNCTION IF EXISTS public.is_member_of_split(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_member_of_split(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_split_participant(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_split_creator(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.ensure_wallet_exists(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.ensure_user_wallet(uuid) CASCADE;

-- =====================================================
-- STEP 2: DROP ALL EXISTING POLICIES ON split_events
-- =====================================================
DROP POLICY IF EXISTS "Users can view their splits" ON split_events;
DROP POLICY IF EXISTS "Users can create splits" ON split_events;
DROP POLICY IF EXISTS "Users can delete splits" ON split_events;
DROP POLICY IF EXISTS "split_events_select" ON split_events;
DROP POLICY IF EXISTS "split_events_insert" ON split_events;
DROP POLICY IF EXISTS "split_events_delete" ON split_events;
DROP POLICY IF EXISTS "split_events_update" ON split_events;

-- =====================================================
-- STEP 3: DROP ALL EXISTING POLICIES ON split_participants
-- =====================================================
DROP POLICY IF EXISTS "Users can view split participants" ON split_participants;
DROP POLICY IF EXISTS "Users can insert split participants" ON split_participants;
DROP POLICY IF EXISTS "Users can update split participants" ON split_participants;
DROP POLICY IF EXISTS "Creators can add participants" ON split_participants;
DROP POLICY IF EXISTS "Users can update own participation" ON split_participants;
DROP POLICY IF EXISTS "Creators can delete split participants" ON split_participants;
DROP POLICY IF EXISTS "split_participants_select" ON split_participants;
DROP POLICY IF EXISTS "split_participants_insert" ON split_participants;
DROP POLICY IF EXISTS "split_participants_update" ON split_participants;
DROP POLICY IF EXISTS "split_participants_delete" ON split_participants;
DROP POLICY IF EXISTS "Users can view all participants in their splits" ON split_participants;

-- =====================================================
-- STEP 4: DROP ALL EXISTING POLICIES ON wallets
-- =====================================================
DROP POLICY IF EXISTS "Users can view own wallet" ON wallets;
DROP POLICY IF EXISTS "Users can update own wallet" ON wallets;
DROP POLICY IF EXISTS "Users can insert own wallet" ON wallets;
DROP POLICY IF EXISTS "wallets_select" ON wallets;
DROP POLICY IF EXISTS "wallets_insert" ON wallets;
DROP POLICY IF EXISTS "wallets_update" ON wallets;

-- =====================================================
-- STEP 5: ENABLE RLS ON ALL TABLES
-- =====================================================
ALTER TABLE split_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE split_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 6: CREATE THE SINGLE HELPER FUNCTION
-- This function checks if the current user is a member of a split
-- Uses SECURITY DEFINER to bypass RLS for the inner query
-- =====================================================
CREATE OR REPLACE FUNCTION public.is_member_of_split(p_split_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is creator of the split
  IF EXISTS (
    SELECT 1 FROM split_events
    WHERE id = p_split_event_id AND creator_id = auth.uid()
  ) THEN
    RETURN true;
  END IF;
  
  -- Check if user is a participant in the split
  IF EXISTS (
    SELECT 1 FROM split_participants
    WHERE split_event_id = p_split_event_id AND user_id = auth.uid()
  ) THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Grant execute to authenticated users only
REVOKE ALL ON FUNCTION public.is_member_of_split(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_member_of_split(uuid) TO authenticated;

-- =====================================================
-- STEP 7: CREATE split_events POLICIES
-- =====================================================

-- SELECT: Users can view splits they created OR are a participant in
CREATE POLICY "split_events_select" ON split_events
  FOR SELECT TO authenticated
  USING (
    creator_id = auth.uid() 
    OR public.is_member_of_split(id)
  );

-- INSERT: Users can create splits (they must be the creator)
CREATE POLICY "split_events_insert" ON split_events
  FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());

-- UPDATE: Only creators can update their splits
CREATE POLICY "split_events_update" ON split_events
  FOR UPDATE TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- DELETE: Only creators can delete their splits
CREATE POLICY "split_events_delete" ON split_events
  FOR DELETE TO authenticated
  USING (creator_id = auth.uid());

-- =====================================================
-- STEP 8: CREATE split_participants POLICIES
-- =====================================================

-- SELECT: Users can view participants if they are a member of the split
CREATE POLICY "split_participants_select" ON split_participants
  FOR SELECT TO authenticated
  USING (public.is_member_of_split(split_event_id));

-- INSERT: Creators can add participants (including adding other users)
CREATE POLICY "split_participants_insert" ON split_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM split_events
      WHERE id = split_event_id AND creator_id = auth.uid()
    )
  );

-- UPDATE: Users can update their own participation OR if they're the creator
CREATE POLICY "split_participants_update" ON split_participants
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM split_events
      WHERE id = split_event_id AND creator_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM split_events
      WHERE id = split_event_id AND creator_id = auth.uid()
    )
  );

-- DELETE: Only creators can delete participants
CREATE POLICY "split_participants_delete" ON split_participants
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM split_events
      WHERE id = split_event_id AND creator_id = auth.uid()
    )
  );

-- =====================================================
-- STEP 9: CREATE wallets POLICIES
-- =====================================================

-- SELECT: Users can view their own wallet
CREATE POLICY "wallets_select" ON wallets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- INSERT: Users can create their own wallet
CREATE POLICY "wallets_insert" ON wallets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: Users can update their own wallet
CREATE POLICY "wallets_update" ON wallets
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- STEP 10: CREATE WALLET HELPER FUNCTION (SECURITY DEFINER)
-- This bypasses RLS to create wallet for a user
-- =====================================================
CREATE OR REPLACE FUNCTION public.ensure_wallet_exists(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet_id UUID;
  v_balance NUMERIC;
BEGIN
  -- Check if wallet exists
  SELECT id, balance INTO v_wallet_id, v_balance
  FROM wallets
  WHERE user_id = p_user_id;
  
  -- If not exists, create it
  IF v_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance, bank_connected)
    VALUES (p_user_id, 0, false)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING id, balance INTO v_wallet_id, v_balance;
    
    -- If insert was skipped due to conflict, fetch the existing record
    IF v_wallet_id IS NULL THEN
      SELECT id, balance INTO v_wallet_id, v_balance
      FROM wallets
      WHERE user_id = p_user_id;
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'wallet_id', v_wallet_id,
    'balance', COALESCE(v_balance, 0)
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute to authenticated users
REVOKE ALL ON FUNCTION public.ensure_wallet_exists(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_wallet_exists(UUID) TO authenticated;

-- Also create the alias function name used in the app
CREATE OR REPLACE FUNCTION public.ensure_user_wallet(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.ensure_wallet_exists(p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_user_wallet(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_user_wallet(UUID) TO authenticated;

-- =====================================================
-- STEP 11: FIX STORAGE POLICIES FOR RECEIPTS
-- =====================================================

-- First ensure the bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('user-uploads', 'user-uploads', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

-- Drop existing storage policies
DROP POLICY IF EXISTS "Authenticated users can upload profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to user-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view user uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own uploads" ON storage.objects;

-- Create storage policies that allow both profile-pictures and receipts folders
CREATE POLICY "Authenticated users can upload to user-uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-uploads' 
  AND (
    (storage.foldername(name))[1] = 'profile-pictures'
    OR (storage.foldername(name))[1] = 'receipts'
  )
);

CREATE POLICY "Anyone can view user uploads"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'user-uploads');

CREATE POLICY "Users can update their own uploads"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'user-uploads')
WITH CHECK (bucket_id = 'user-uploads');

CREATE POLICY "Users can delete their own uploads"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'user-uploads');

-- =====================================================
-- STEP 12: NOTIFICATIONS TABLE RLS (for realtime updates)
-- =====================================================

-- Enable RLS on notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
DROP POLICY IF EXISTS "notifications_select" ON notifications;
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
DROP POLICY IF EXISTS "notifications_update" ON notifications;
DROP POLICY IF EXISTS "notifications_delete" ON notifications;
DROP POLICY IF EXISTS "Service can insert notifications" ON notifications;

-- Users can view their own notifications
CREATE POLICY "notifications_select" ON notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Allow insert (for backend/service role - also allow authenticated for edge cases)
CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "notifications_delete" ON notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- =====================================================
-- STEP 13: ENABLE REALTIME FOR NOTIFICATIONS TABLE
-- This allows Supabase realtime subscriptions to work
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- =====================================================
-- STEP 14: CREATE WALLETS FOR ALL EXISTING USERS
-- This ensures every user has a wallet
-- =====================================================
INSERT INTO wallets (user_id, balance, bank_connected)
SELECT id, 0, false FROM users
WHERE id NOT IN (SELECT user_id FROM wallets WHERE user_id IS NOT NULL)
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================
-- VERIFICATION QUERIES - Run these to verify the fix worked
-- =====================================================

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('split_events', 'split_participants', 'wallets', 'notifications');

-- List all policies on split_events
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'split_events';

-- List all policies on split_participants  
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'split_participants';

-- List all policies on wallets
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'wallets';

-- Check helper function exists
SELECT proname, prosecdef 
FROM pg_proc 
WHERE proname IN ('is_member_of_split', 'ensure_wallet_exists', 'ensure_user_wallet');
