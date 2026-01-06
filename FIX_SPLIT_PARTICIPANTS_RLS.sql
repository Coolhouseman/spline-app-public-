-- PROPER FIX: Secure RLS for split_participants without infinite recursion
-- This uses a SECURITY DEFINER function to avoid RLS recursion

-- Step 1: Enable RLS and drop existing policies
ALTER TABLE split_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "split_participants_select" ON split_participants;
DROP POLICY IF EXISTS "split_participants_insert" ON split_participants;
DROP POLICY IF EXISTS "split_participants_update" ON split_participants;
DROP POLICY IF EXISTS "split_participants_delete" ON split_participants;
DROP POLICY IF EXISTS "Users can view all participants in their splits" ON split_participants;
DROP POLICY IF EXISTS "Users can insert split participants" ON split_participants;
DROP POLICY IF EXISTS "Users can update split participants" ON split_participants;
DROP POLICY IF EXISTS "Creators can delete split participants" ON split_participants;

-- Step 2: Create SECURITY DEFINER helper function
-- This function checks if the current user is a member of a split
-- SECURITY DEFINER runs with owner privileges, bypassing RLS on inner queries
CREATE OR REPLACE FUNCTION public.is_member_of_split(p_split_event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM split_events se
    WHERE se.id = p_split_event_id
      AND (
        se.creator_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM split_participants sp2
          WHERE sp2.split_event_id = se.id
            AND sp2.user_id = auth.uid()
        )
      )
  );
END;
$$;

-- Secure the function - only authenticated users can call it
REVOKE ALL ON FUNCTION public.is_member_of_split(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_member_of_split(uuid) TO authenticated;

-- Step 3: Create policies using the helper function

-- SELECT: Users can see all participants for splits they're a member of
CREATE POLICY "split_participants_select" ON split_participants
  FOR SELECT 
  USING (public.is_member_of_split(split_event_id));

-- INSERT: Users can add participants to splits they're part of, or add themselves
CREATE POLICY "split_participants_insert" ON split_participants
  FOR INSERT
  WITH CHECK (
    public.is_member_of_split(split_event_id)
    OR auth.uid() = user_id
  );

-- UPDATE: Users can update participant records for splits they're part of
CREATE POLICY "split_participants_update" ON split_participants
  FOR UPDATE 
  USING (public.is_member_of_split(split_event_id))
  WITH CHECK (public.is_member_of_split(split_event_id));

-- DELETE: Only split creators can delete participants
CREATE POLICY "split_participants_delete" ON split_participants
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM split_events se
      WHERE se.id = split_event_id
        AND se.creator_id = auth.uid()
    )
  );

-- VERIFY: After running this:
-- 1. User A creates a split with User B
-- 2. User B logs in and views the split
-- 3. User B should see BOTH participants (A and B) with correct progress
