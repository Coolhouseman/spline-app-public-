-- ============================================================
-- FIX SUPABASE POLICIES - Split Creation & Wallet Display
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- =====================================================
-- PART 1: FIX STORAGE POLICIES FOR RECEIPT UPLOADS
-- =====================================================

-- Drop existing storage policies and recreate with receipts folder support
DROP POLICY IF EXISTS "Authenticated users can upload profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to user-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own uploads" ON storage.objects;

-- Allow authenticated users to upload to BOTH profile-pictures AND receipts folders
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

-- Anyone can view files in user-uploads bucket (for profile pics and receipts)
CREATE POLICY "Anyone can view user uploads"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'user-uploads');

-- Users can update their own uploads
CREATE POLICY "Users can update their own uploads"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'user-uploads')
WITH CHECK (bucket_id = 'user-uploads');

-- Users can delete their own uploads
CREATE POLICY "Users can delete their own uploads"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'user-uploads');

-- =====================================================
-- PART 2: FIX SPLIT_EVENTS RLS POLICIES
-- =====================================================

-- Enable RLS on split_events
ALTER TABLE split_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their splits" ON split_events;
DROP POLICY IF EXISTS "Users can create splits" ON split_events;
DROP POLICY IF EXISTS "Users can delete splits" ON split_events;
DROP POLICY IF EXISTS "split_events_select" ON split_events;
DROP POLICY IF EXISTS "split_events_insert" ON split_events;
DROP POLICY IF EXISTS "split_events_delete" ON split_events;

-- Create SECURITY DEFINER function to check if user is participant
-- This avoids the infinite recursion issue
CREATE OR REPLACE FUNCTION public.is_split_participant(p_split_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM split_participants
    WHERE split_event_id = p_split_id
      AND user_id = auth.uid()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_split_participant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_split_participant(uuid) TO authenticated;

-- SELECT: Users can view splits they're part of (as creator or participant)
CREATE POLICY "split_events_select" ON split_events
  FOR SELECT
  USING (
    creator_id = auth.uid() 
    OR public.is_split_participant(id)
  );

-- INSERT: Users can create splits (must be the creator)
CREATE POLICY "split_events_insert" ON split_events
  FOR INSERT
  WITH CHECK (creator_id = auth.uid());

-- DELETE: Only creators can delete their splits
CREATE POLICY "split_events_delete" ON split_events
  FOR DELETE
  USING (creator_id = auth.uid());

-- =====================================================
-- PART 3: FIX SPLIT_PARTICIPANTS RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE split_participants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "split_participants_select" ON split_participants;
DROP POLICY IF EXISTS "split_participants_insert" ON split_participants;
DROP POLICY IF EXISTS "split_participants_update" ON split_participants;
DROP POLICY IF EXISTS "split_participants_delete" ON split_participants;
DROP POLICY IF EXISTS "Users can view split participants" ON split_participants;
DROP POLICY IF EXISTS "Creators can add participants" ON split_participants;
DROP POLICY IF EXISTS "Users can update own participation" ON split_participants;

-- Create helper function to check if user is creator of a split
CREATE OR REPLACE FUNCTION public.is_split_creator(p_split_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM split_events
    WHERE id = p_split_id
      AND creator_id = auth.uid()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_split_creator(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_split_creator(uuid) TO authenticated;

-- SELECT: Users can see participants for splits they're in
CREATE POLICY "split_participants_select" ON split_participants
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_split_creator(split_event_id)
    OR EXISTS (
      SELECT 1 FROM split_participants sp2
      WHERE sp2.split_event_id = split_participants.split_event_id
        AND sp2.user_id = auth.uid()
    )
  );

-- INSERT: Creators can add participants to their splits
CREATE POLICY "split_participants_insert" ON split_participants
  FOR INSERT
  WITH CHECK (public.is_split_creator(split_event_id));

-- UPDATE: Users can update their own participation OR creators can update any
CREATE POLICY "split_participants_update" ON split_participants
  FOR UPDATE
  USING (user_id = auth.uid() OR public.is_split_creator(split_event_id))
  WITH CHECK (user_id = auth.uid() OR public.is_split_creator(split_event_id));

-- DELETE: Only creators can delete participants
CREATE POLICY "split_participants_delete" ON split_participants
  FOR DELETE
  USING (public.is_split_creator(split_event_id));

-- =====================================================
-- PART 4: FIX WALLETS RLS POLICIES
-- =====================================================

-- Enable RLS on wallets
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own wallet" ON wallets;
DROP POLICY IF EXISTS "Users can update own wallet" ON wallets;
DROP POLICY IF EXISTS "Users can insert own wallet" ON wallets;
DROP POLICY IF EXISTS "wallets_select" ON wallets;
DROP POLICY IF EXISTS "wallets_update" ON wallets;
DROP POLICY IF EXISTS "wallets_insert" ON wallets;

-- SELECT: Users can view their own wallet
CREATE POLICY "wallets_select" ON wallets
  FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: Users can create their own wallet
CREATE POLICY "wallets_insert" ON wallets
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- UPDATE: Users can update their own wallet
CREATE POLICY "wallets_update" ON wallets
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =====================================================
-- PART 5: ENSURE WALLET EXISTS FUNCTION (for auto-creation)
-- =====================================================

-- This RPC function can be called to ensure a wallet exists for a user
-- It bypasses RLS to create the wallet if needed
CREATE OR REPLACE FUNCTION public.ensure_user_wallet(p_user_id UUID)
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
REVOKE ALL ON FUNCTION public.ensure_user_wallet(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_user_wallet(UUID) TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Verify storage bucket exists with correct settings
SELECT id, name, public FROM storage.buckets WHERE id = 'user-uploads';

-- Verify RLS is enabled on key tables
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('split_events', 'split_participants', 'wallets');
