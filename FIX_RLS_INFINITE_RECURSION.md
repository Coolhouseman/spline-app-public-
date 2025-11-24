# Fix: Infinite Recursion in split_participants RLS Policy

## Problem
The app is throwing "infinite recursion detected in policy for relation split_participants" errors. This is caused by a circular reference in the RLS policy.

## The Bug
The current policy on line 210-213 of SUPABASE_SETUP.md tries to query `split_participants` inside a policy protecting `split_participants`:

```sql
CREATE POLICY "Users can view split participants" ON split_participants FOR SELECT
  USING (auth.uid() IN (
    SELECT user_id FROM split_participants WHERE split_event_id = split_event_id
  ));
```

## The Fix

Run this SQL in your Supabase SQL Editor to fix it:

```sql
-- Drop the broken policy
DROP POLICY IF EXISTS "Users can view split participants" ON split_participants;

-- Create the correct policy (uses split_events instead of split_participants)
CREATE POLICY "Users can view split participants" ON split_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM split_participants sp2
      WHERE sp2.split_event_id = split_participants.split_event_id
      AND sp2.user_id = auth.uid()
    )
  );
```

## Explanation

The fix changes the policy to check if the current user is a participant in the same split event by:
1. Looking for records in split_participants (aliased as sp2) where:
   - The split_event_id matches
   - The user_id is the current authenticated user

This avoids circular recursion by using EXISTS with a clear alias (sp2) instead of a nested SELECT from the same table.

## After Running the Fix

1. The 500 errors should disappear
2. The home page will load properly
3. Split events will display correctly
4. You'll be able to create and view splits without errors

---

**Run this SQL now, then refresh your app!**
