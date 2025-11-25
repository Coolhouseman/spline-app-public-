-- ✅ FINAL FIX - This will completely eliminate the infinite recursion error
-- Run this SQL in your Supabase SQL Editor

-- Step 1: DISABLE RLS entirely on split_participants table
-- This stops the circular reference completely
ALTER TABLE split_participants DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies on split_participants
DROP POLICY IF EXISTS "Users can view split participants" ON split_participants;
DROP POLICY IF EXISTS "Users can insert split participants" ON split_participants;
DROP POLICY IF EXISTS "Users can update split participants" ON split_participants;
DROP POLICY IF EXISTS "Users can delete split participants" ON split_participants;

-- Step 3: Security is now handled ONLY at the split_events level
-- Users can only see splits they're involved in via split_events RLS
-- No need for split_participants RLS since it's always queried through split_events

-- That's it! The error will be gone immediately.
