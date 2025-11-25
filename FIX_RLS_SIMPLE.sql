-- Simpler fix for infinite recursion in split_participants RLS policies
-- Run this SQL in your Supabase SQL Editor

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view split participants" ON split_participants;

-- Create a simple, non-recursive policy
-- Users can view participants in splits they created OR their own participation records
CREATE POLICY "Users can view split participants" ON split_participants FOR SELECT
  USING (
    user_id = auth.uid()  -- Can see their own participation
    OR
    split_event_id IN (
      SELECT id FROM split_events WHERE creator_id = auth.uid()  -- Can see participants in splits they created
    )
  );
