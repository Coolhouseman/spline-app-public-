-- BLOCK AND REPORT FIX MIGRATION
-- Run this in your Supabase SQL Editor to fix the block_user function
-- This corrects the reference from 'friend_requests' to 'friends' table

-- =============================================
-- 1. DROP AND RECREATE block_user FUNCTION
-- =============================================
DROP FUNCTION IF EXISTS block_user(UUID, UUID);

CREATE OR REPLACE FUNCTION block_user(
  p_user_id UUID,
  p_blocked_user_id UUID
) RETURNS VOID AS $$
BEGIN
  -- Insert block record
  INSERT INTO public.blocked_users (user_id, blocked_user_id)
  VALUES (p_user_id, p_blocked_user_id)
  ON CONFLICT (user_id, blocked_user_id) DO NOTHING;
  
  -- Remove any existing friendship (both directions)
  DELETE FROM public.friends 
  WHERE (user_id = p_user_id AND friend_id = p_blocked_user_id)
     OR (user_id = p_blocked_user_id AND friend_id = p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- =============================================
-- 2. VERIFY THE FIX
-- =============================================
SELECT 'block_user function updated successfully' as status;
