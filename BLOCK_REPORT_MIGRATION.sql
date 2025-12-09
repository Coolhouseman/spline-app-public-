-- BLOCK AND REPORT FEATURE MIGRATION
-- Run this in your Supabase SQL Editor

-- =============================================
-- 1. CREATE BLOCKED USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS blocked_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, blocked_user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_blocked_users_user_id ON blocked_users(user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked_user_id ON blocked_users(blocked_user_id);

-- Enable RLS
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies for blocked_users
DROP POLICY IF EXISTS "Users can view their blocked list" ON blocked_users;
CREATE POLICY "Users can view their blocked list"
ON blocked_users FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can block other users" ON blocked_users;
CREATE POLICY "Users can block other users"
ON blocked_users FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can unblock users" ON blocked_users;
CREATE POLICY "Users can unblock users"
ON blocked_users FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- =============================================
-- 2. CREATE USER REPORTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS user_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'resolved', 'dismissed')),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_reports_reporter_id ON user_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_reported_user_id ON user_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_status ON user_reports(status);
CREATE INDEX IF NOT EXISTS idx_user_reports_created_at ON user_reports(created_at DESC);

-- Enable RLS
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_reports
DROP POLICY IF EXISTS "Users can create reports" ON user_reports;
CREATE POLICY "Users can create reports"
ON user_reports FOR INSERT
TO authenticated
WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "Users can view their own reports" ON user_reports;
CREATE POLICY "Users can view their own reports"
ON user_reports FOR SELECT
TO authenticated
USING (reporter_id = auth.uid());

-- Service role has full access (for admin dashboard)
DROP POLICY IF EXISTS "Service role full access to reports" ON user_reports;
CREATE POLICY "Service role full access to reports"
ON user_reports FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- =============================================
-- 3. FUNCTION TO BLOCK USER (also removes friendship)
-- =============================================
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
  
  -- Remove any pending friend requests (both directions)
  DELETE FROM public.friend_requests 
  WHERE (sender_id = p_user_id AND receiver_id = p_blocked_user_id)
     OR (sender_id = p_blocked_user_id AND receiver_id = p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- =============================================
-- 4. FUNCTION TO CHECK IF USER IS BLOCKED
-- =============================================
CREATE OR REPLACE FUNCTION is_user_blocked(
  p_user_id UUID,
  p_other_user_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.blocked_users 
    WHERE (user_id = p_user_id AND blocked_user_id = p_other_user_id)
       OR (user_id = p_other_user_id AND blocked_user_id = p_user_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- =============================================
-- 5. FUNCTION TO CREATE REPORT
-- =============================================
CREATE OR REPLACE FUNCTION create_user_report(
  p_reporter_id UUID,
  p_reported_user_id UUID,
  p_reason TEXT
) RETURNS UUID AS $$
DECLARE
  v_report_id UUID;
BEGIN
  INSERT INTO public.user_reports (reporter_id, reported_user_id, reason)
  VALUES (p_reporter_id, p_reported_user_id, p_reason)
  RETURNING id INTO v_report_id;
  
  RETURN v_report_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- =============================================
-- 6. VERIFY TABLES CREATED
-- =============================================
SELECT 'blocked_users' as table_name, COUNT(*) as row_count FROM blocked_users
UNION ALL
SELECT 'user_reports' as table_name, COUNT(*) as row_count FROM user_reports;
