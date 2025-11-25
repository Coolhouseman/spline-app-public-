-- Fix infinite recursion in split_participants RLS policies
-- Run this SQL in your Supabase SQL Editor

-- Step 1: Drop the problematic policy
DROP POLICY IF EXISTS "Users can view split participants" ON split_participants;

-- Step 2: Create a corrected policy that doesn't create infinite recursion
-- Users can view participants if they are participating in the same split event
CREATE POLICY "Users can view split participants" ON split_participants FOR SELECT
  USING (
    split_event_id IN (
      SELECT se.id 
      FROM split_events se
      INNER JOIN split_participants sp ON sp.split_event_id = se.id
      WHERE sp.user_id = auth.uid()
    )
  );

-- Alternative simpler approach (if the above still has issues):
-- Users can view participants in splits they created OR participate in
/*
DROP POLICY IF EXISTS "Users can view split participants" ON split_participants;

CREATE POLICY "Users can view split participants" ON split_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM split_events se
      WHERE se.id = split_participants.split_event_id
      AND (se.creator_id = auth.uid() OR split_participants.user_id = auth.uid())
    )
  );
*/
