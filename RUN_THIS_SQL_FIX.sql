-- ⚠️ RUN THIS SQL IN YOUR SUPABASE SQL EDITOR TO FIX THE INFINITE RECURSION ERROR
-- This will fix the "infinite recursion detected in policy for relation split_participants" error

-- Step 1: Drop the problematic policy that creates circular reference
DROP POLICY IF EXISTS "Users can view split participants" ON split_participants;

-- Step 2: Create a simple, non-recursive policy
-- Users can view participants if:
-- 1. They ARE a participant in that split (their own records)
-- 2. They CREATED that split (can see all participants)
CREATE POLICY "Users can view split participants" ON split_participants FOR SELECT
  USING (
    user_id = auth.uid()  -- Can see their own participation records
    OR
    split_event_id IN (
      SELECT id FROM split_events WHERE creator_id = auth.uid()  -- Can see participants in splits they created
    )
  );

-- That's it! The infinite recursion error should be gone after running this.
