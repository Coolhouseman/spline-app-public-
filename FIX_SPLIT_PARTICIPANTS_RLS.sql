-- FIX: Allow users to see ALL participants for splits they're a member of
-- This fixes the bug where participants only see themselves instead of all participants

-- Step 1: Enable RLS on split_participants (if not already enabled)
ALTER TABLE split_participants ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view split participants" ON split_participants;
DROP POLICY IF EXISTS "Users can view their own participants" ON split_participants;
DROP POLICY IF EXISTS "split_participants_select" ON split_participants;

-- Step 3: Create new policy that allows users to see ALL participants for splits they're part of
CREATE POLICY "Users can view all participants in their splits"
ON split_participants
FOR SELECT
USING (
  split_event_id IN (
    SELECT sp.split_event_id 
    FROM split_participants sp 
    WHERE sp.user_id = auth.uid()
  )
);

-- Step 4: Allow users to insert their own participant records (for creating splits)
DROP POLICY IF EXISTS "Users can insert split participants" ON split_participants;
CREATE POLICY "Users can insert split participants"
ON split_participants
FOR INSERT
WITH CHECK (true);

-- Step 5: Allow users to update participant records for splits they're part of
DROP POLICY IF EXISTS "Users can update split participants" ON split_participants;
CREATE POLICY "Users can update split participants"
ON split_participants
FOR UPDATE
USING (
  split_event_id IN (
    SELECT sp.split_event_id 
    FROM split_participants sp 
    WHERE sp.user_id = auth.uid()
  )
);

-- Step 6: Allow delete for split creators/admins
DROP POLICY IF EXISTS "Users can delete split participants" ON split_participants;
CREATE POLICY "Creators can delete split participants"
ON split_participants
FOR DELETE
USING (
  split_event_id IN (
    SELECT se.id 
    FROM split_events se 
    WHERE se.creator_id = auth.uid()
  )
);

-- VERIFY: After running this, test by:
-- 1. User A creates a split with User B
-- 2. User B logs in and views the split
-- 3. User B should see BOTH participants (A and B) not just themselves
