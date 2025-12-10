-- Spline Rate Limiting Implementation
-- This migration provides optional database tables for persistent rate limiting
-- Current implementation uses in-memory rate limiting which is effective but resets on server restart

-- =============================================
-- OTP Rate Limiting (Currently In-Memory)
-- =============================================
-- Current limits:
-- - Max 3 OTP requests per phone number per 10 minutes
-- - Max 6 OTP requests per phone number per hour  
-- - Max 10 OTP requests per IP address per hour

-- Optional: Persistent OTP request logging table (for audit purposes)
CREATE TABLE IF NOT EXISTS otp_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  ip_address INET,
  status TEXT NOT NULL DEFAULT 'sent',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_logs_phone_time ON otp_request_logs (phone_number, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_logs_ip_time ON otp_request_logs (ip_address, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_logs_requested_at ON otp_request_logs USING BRIN (requested_at);

-- RLS policy - service role only
ALTER TABLE otp_request_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role only" ON otp_request_logs FOR ALL USING (false);

-- Cleanup old records (run periodically)
-- DELETE FROM otp_request_logs WHERE requested_at < NOW() - INTERVAL '24 hours';

-- =============================================
-- Split Creation Rate Limiting (Database-Based)
-- =============================================
-- Current limits checked against split_events table:
-- - Max 5 splits per user per hour
-- - Max 15 splits per user per day
-- These limits are enforced by querying split_events.created_at directly

-- Helper function to check split creation rate limit
CREATE OR REPLACE FUNCTION check_split_rate_limit(p_user_id UUID)
RETURNS TABLE (
  allowed BOOLEAN,
  error_message TEXT,
  splits_last_hour INT,
  splits_last_day INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_splits_last_hour INT;
  v_splits_last_day INT;
  v_max_per_hour INT := 5;
  v_max_per_day INT := 15;
BEGIN
  -- Count splits in the last hour
  SELECT COUNT(*) INTO v_splits_last_hour
  FROM split_events
  WHERE creator_id = p_user_id
    AND created_at >= NOW() - INTERVAL '1 hour';
  
  -- Count splits in the last 24 hours
  SELECT COUNT(*) INTO v_splits_last_day
  FROM split_events
  WHERE creator_id = p_user_id
    AND created_at >= NOW() - INTERVAL '24 hours';
  
  -- Check limits
  IF v_splits_last_hour >= v_max_per_hour THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      format('You can only create %s splits per hour. Please wait before creating another split.', v_max_per_hour),
      v_splits_last_hour,
      v_splits_last_day;
    RETURN;
  END IF;
  
  IF v_splits_last_day >= v_max_per_day THEN
    RETURN QUERY SELECT 
      false::BOOLEAN,
      format('You can only create %s splits per day. Please try again tomorrow.', v_max_per_day),
      v_splits_last_hour,
      v_splits_last_day;
    RETURN;
  END IF;
  
  -- All checks passed
  RETURN QUERY SELECT 
    true::BOOLEAN,
    NULL::TEXT,
    v_splits_last_hour,
    v_splits_last_day;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_split_rate_limit(UUID) TO authenticated;

-- =============================================
-- Summary of Rate Limits
-- =============================================
-- 
-- OTP Requests (SMS Verification):
--   - Per Phone Number: 3 per 10 min, 6 per hour
--   - Per IP Address: 10 per hour
--   - Enforcement: In-memory on server
-- 
-- Split Event Creation:
--   - Per User: 5 per hour, 15 per day
--   - Enforcement: Client-side + Database query
--
-- Friend Requests (Existing):
--   - 24 hour cooldown between requests to same user
--   - Enforcement: last_reminder_at column in friends table
--
-- Deposits/Withdrawals (Existing - see replit.md):
--   - Max 2 deposits per day
--   - Max 3 withdrawals per day
--   - Max 4 withdrawals per month per type
--   - 5-day hold on deposited funds before withdrawal
