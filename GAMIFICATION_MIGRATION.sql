-- Spline Gamification System Migration
-- Run this in Supabase SQL Editor

-- =============================================================================
-- TABLE 1: user_gamification - Main gamification profile for each user
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_gamification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- XP and Leveling
  total_xp INTEGER NOT NULL DEFAULT 0,
  current_level INTEGER NOT NULL DEFAULT 1,
  xp_to_next_level INTEGER NOT NULL DEFAULT 100,
  
  -- Streaks
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  
  -- Lifetime Stats
  splits_created INTEGER NOT NULL DEFAULT 0,
  splits_paid_on_time INTEGER NOT NULL DEFAULT 0,
  splits_completed_as_creator INTEGER NOT NULL DEFAULT 0,
  total_amount_split NUMERIC(10,2) NOT NULL DEFAULT 0,
  friends_referred INTEGER NOT NULL DEFAULT 0,
  
  -- Social Status
  title VARCHAR(50) NOT NULL DEFAULT 'Newcomer',
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_user_gamification UNIQUE(user_id)
);

-- =============================================================================
-- TABLE 2: xp_history - Log of all XP awards for transparency
-- =============================================================================
CREATE TABLE IF NOT EXISTS xp_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  xp_amount INTEGER NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  -- Action types: 'split_created', 'split_paid', 'split_completed', 'streak_bonus', 
  -- 'first_split', 'referral', 'fast_payer', 'perfect_month'
  
  description TEXT,
  split_event_id UUID REFERENCES split_events(id) ON DELETE SET NULL,
  
  -- Level at time of award (for history)
  level_at_award INTEGER NOT NULL DEFAULT 1,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABLE 3: user_badges - Achievements/badges earned by users
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  badge_id VARCHAR(50) NOT NULL,
  badge_name VARCHAR(100) NOT NULL,
  badge_description TEXT,
  badge_icon VARCHAR(50), -- Feather icon name
  badge_tier VARCHAR(20) NOT NULL DEFAULT 'bronze', -- bronze, silver, gold, platinum
  
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_user_badge UNIQUE(user_id, badge_id)
);

-- =============================================================================
-- INDEXES for performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_user_gamification_user_id ON user_gamification(user_id);
CREATE INDEX IF NOT EXISTS idx_user_gamification_level ON user_gamification(current_level DESC);
CREATE INDEX IF NOT EXISTS idx_user_gamification_xp ON user_gamification(total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_xp_history_user_id ON xp_history(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_history_created_at ON xp_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);

-- =============================================================================
-- RLS Policies
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE user_gamification ENABLE ROW LEVEL SECURITY;
ALTER TABLE xp_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- user_gamification policies
CREATE POLICY "Users can view their own gamification profile"
  ON user_gamification FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view friends gamification profiles"
  ON user_gamification FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM friendships
      WHERE status = 'accepted'
      AND ((user_id = auth.uid() AND friend_id = user_gamification.user_id)
           OR (friend_id = auth.uid() AND user_id = user_gamification.user_id))
    )
  );

CREATE POLICY "Service role can manage all gamification"
  ON user_gamification FOR ALL
  USING (true)
  WITH CHECK (true);

-- xp_history policies
CREATE POLICY "Users can view their own XP history"
  ON xp_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all XP history"
  ON xp_history FOR ALL
  USING (true)
  WITH CHECK (true);

-- user_badges policies
CREATE POLICY "Users can view their own badges"
  ON user_badges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view friends badges"
  ON user_badges FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM friendships
      WHERE status = 'accepted'
      AND ((user_id = auth.uid() AND friend_id = user_badges.user_id)
           OR (friend_id = auth.uid() AND user_id = user_badges.user_id))
    )
  );

CREATE POLICY "Service role can manage all badges"
  ON user_badges FOR ALL
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- RPC Function: Initialize gamification for a user
-- =============================================================================
CREATE OR REPLACE FUNCTION initialize_user_gamification(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  INSERT INTO user_gamification (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  SELECT jsonb_build_object(
    'success', true,
    'user_id', p_user_id
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- =============================================================================
-- RPC Function: Award XP to a user with level-up handling
-- =============================================================================
CREATE OR REPLACE FUNCTION award_xp(
  p_user_id UUID,
  p_xp_amount INTEGER,
  p_action_type VARCHAR(50),
  p_description TEXT DEFAULT NULL,
  p_split_event_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_xp INTEGER;
  v_current_level INTEGER;
  v_xp_to_next INTEGER;
  v_new_xp INTEGER;
  v_new_level INTEGER;
  v_new_xp_to_next INTEGER;
  v_leveled_up BOOLEAN := false;
  v_new_title VARCHAR(50);
  v_result JSONB;
BEGIN
  -- Get current gamification state
  SELECT total_xp, current_level, xp_to_next_level
  INTO v_current_xp, v_current_level, v_xp_to_next
  FROM user_gamification
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- Initialize if not exists
  IF NOT FOUND THEN
    INSERT INTO user_gamification (user_id)
    VALUES (p_user_id);
    v_current_xp := 0;
    v_current_level := 1;
    v_xp_to_next := 100;
  END IF;
  
  -- Calculate new XP
  v_new_xp := v_current_xp + p_xp_amount;
  v_new_level := v_current_level;
  v_new_xp_to_next := v_xp_to_next;
  
  -- Check for level ups (exponential scaling: level N requires N*100 XP)
  WHILE v_new_xp >= v_new_xp_to_next LOOP
    v_new_level := v_new_level + 1;
    v_leveled_up := true;
    -- Each level requires progressively more XP: 100, 200, 350, 550, 800, 1100...
    -- Formula: level * 50 + (level-1) * 50 = level * 100 - 50 for early, then scales
    v_new_xp_to_next := v_new_xp_to_next + (v_new_level * 75);
  END LOOP;
  
  -- Determine title based on level
  v_new_title := CASE
    WHEN v_new_level >= 50 THEN 'Elite Splitter'
    WHEN v_new_level >= 40 THEN 'Master Organizer'
    WHEN v_new_level >= 30 THEN 'Split Legend'
    WHEN v_new_level >= 25 THEN 'Bill Boss'
    WHEN v_new_level >= 20 THEN 'Payment Pro'
    WHEN v_new_level >= 15 THEN 'Split Champion'
    WHEN v_new_level >= 10 THEN 'Trusted Splitter'
    WHEN v_new_level >= 7 THEN 'Rising Star'
    WHEN v_new_level >= 5 THEN 'Active Member'
    WHEN v_new_level >= 3 THEN 'Getting Started'
    ELSE 'Newcomer'
  END;
  
  -- Update gamification record
  UPDATE user_gamification
  SET 
    total_xp = v_new_xp,
    current_level = v_new_level,
    xp_to_next_level = v_new_xp_to_next,
    title = v_new_title,
    last_activity_date = CURRENT_DATE,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Log the XP award
  INSERT INTO xp_history (user_id, xp_amount, action_type, description, split_event_id, level_at_award)
  VALUES (p_user_id, p_xp_amount, p_action_type, p_description, p_split_event_id, v_new_level);
  
  -- Build result
  SELECT jsonb_build_object(
    'success', true,
    'xp_awarded', p_xp_amount,
    'new_total_xp', v_new_xp,
    'new_level', v_new_level,
    'xp_to_next_level', v_new_xp_to_next,
    'leveled_up', v_leveled_up,
    'old_level', v_current_level,
    'new_title', v_new_title
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;

-- =============================================================================
-- RPC Function: Update user stats after split actions
-- =============================================================================
CREATE OR REPLACE FUNCTION update_gamification_stats(
  p_user_id UUID,
  p_stat_type VARCHAR(50),
  p_amount NUMERIC DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Initialize if not exists
  INSERT INTO user_gamification (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Update the relevant stat
  IF p_stat_type = 'splits_created' THEN
    UPDATE user_gamification SET splits_created = splits_created + 1, updated_at = NOW() WHERE user_id = p_user_id;
  ELSIF p_stat_type = 'splits_paid_on_time' THEN
    UPDATE user_gamification SET splits_paid_on_time = splits_paid_on_time + 1, updated_at = NOW() WHERE user_id = p_user_id;
  ELSIF p_stat_type = 'splits_completed_as_creator' THEN
    UPDATE user_gamification SET splits_completed_as_creator = splits_completed_as_creator + 1, updated_at = NOW() WHERE user_id = p_user_id;
  ELSIF p_stat_type = 'total_amount_split' THEN
    UPDATE user_gamification SET total_amount_split = total_amount_split + p_amount, updated_at = NOW() WHERE user_id = p_user_id;
  ELSIF p_stat_type = 'friends_referred' THEN
    UPDATE user_gamification SET friends_referred = friends_referred + 1, updated_at = NOW() WHERE user_id = p_user_id;
  END IF;
  
  RETURN jsonb_build_object('success', true, 'stat_type', p_stat_type);
END;
$$;

-- =============================================================================
-- RPC Function: Update streak
-- =============================================================================
CREATE OR REPLACE FUNCTION update_user_streak(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_activity DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
  v_new_streak INTEGER;
  v_streak_bonus INTEGER := 0;
BEGIN
  -- Get current streak info
  SELECT last_activity_date, current_streak, longest_streak
  INTO v_last_activity, v_current_streak, v_longest_streak
  FROM user_gamification
  WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    -- Initialize if not exists
    INSERT INTO user_gamification (user_id, current_streak, last_activity_date)
    VALUES (p_user_id, 1, CURRENT_DATE);
    RETURN jsonb_build_object('success', true, 'new_streak', 1, 'streak_bonus_xp', 0);
  END IF;
  
  -- Calculate new streak
  IF v_last_activity IS NULL OR v_last_activity < CURRENT_DATE - INTERVAL '1 day' THEN
    -- Streak broken or first activity
    v_new_streak := 1;
  ELSIF v_last_activity = CURRENT_DATE - INTERVAL '1 day' THEN
    -- Consecutive day - increase streak
    v_new_streak := v_current_streak + 1;
    -- Award streak bonus XP (every 7 days)
    IF v_new_streak % 7 = 0 THEN
      v_streak_bonus := v_new_streak * 2; -- 14 XP at 7 days, 28 at 14, etc.
    END IF;
  ELSE
    -- Same day - no change
    v_new_streak := v_current_streak;
  END IF;
  
  -- Update streak
  UPDATE user_gamification
  SET 
    current_streak = v_new_streak,
    longest_streak = GREATEST(v_longest_streak, v_new_streak),
    last_activity_date = CURRENT_DATE,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'new_streak', v_new_streak,
    'longest_streak', GREATEST(v_longest_streak, v_new_streak),
    'streak_bonus_xp', v_streak_bonus
  );
END;
$$;

-- =============================================================================
-- RPC Function: Award badge to user
-- =============================================================================
CREATE OR REPLACE FUNCTION award_badge(
  p_user_id UUID,
  p_badge_id VARCHAR(50),
  p_badge_name VARCHAR(100),
  p_badge_description TEXT,
  p_badge_icon VARCHAR(50),
  p_badge_tier VARCHAR(20) DEFAULT 'bronze'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_already_has BOOLEAN;
BEGIN
  -- Check if user already has this badge
  SELECT EXISTS(
    SELECT 1 FROM user_badges WHERE user_id = p_user_id AND badge_id = p_badge_id
  ) INTO v_already_has;
  
  IF v_already_has THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_has_badge');
  END IF;
  
  -- Award the badge
  INSERT INTO user_badges (user_id, badge_id, badge_name, badge_description, badge_icon, badge_tier)
  VALUES (p_user_id, p_badge_id, p_badge_name, p_badge_description, p_badge_icon, p_badge_tier);
  
  RETURN jsonb_build_object(
    'success', true,
    'badge_id', p_badge_id,
    'badge_name', p_badge_name,
    'badge_tier', p_badge_tier
  );
END;
$$;

-- =============================================================================
-- RPC Function: Get user gamification profile with badges
-- =============================================================================
CREATE OR REPLACE FUNCTION get_user_gamification(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gamification RECORD;
  v_badges JSONB;
  v_recent_xp JSONB;
  v_xp_progress NUMERIC;
BEGIN
  -- Get gamification record
  SELECT * INTO v_gamification FROM user_gamification WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    -- Initialize and return defaults
    PERFORM initialize_user_gamification(p_user_id);
    RETURN jsonb_build_object(
      'total_xp', 0,
      'current_level', 1,
      'xp_to_next_level', 100,
      'xp_progress_percent', 0,
      'current_streak', 0,
      'longest_streak', 0,
      'title', 'Newcomer',
      'splits_created', 0,
      'splits_paid_on_time', 0,
      'splits_completed_as_creator', 0,
      'total_amount_split', 0,
      'friends_referred', 0,
      'badges', '[]'::jsonb,
      'recent_xp', '[]'::jsonb
    );
  END IF;
  
  -- Get badges
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'badge_id', badge_id,
    'badge_name', badge_name,
    'badge_description', badge_description,
    'badge_icon', badge_icon,
    'badge_tier', badge_tier,
    'earned_at', earned_at
  ) ORDER BY earned_at DESC), '[]'::jsonb)
  INTO v_badges
  FROM user_badges
  WHERE user_id = p_user_id;
  
  -- Get recent XP history (last 10)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'xp_amount', xp_amount,
    'action_type', action_type,
    'description', description,
    'created_at', created_at
  ) ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_recent_xp
  FROM (
    SELECT * FROM xp_history WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 10
  ) recent;
  
  -- Calculate XP progress to next level
  -- Need to figure out XP earned in current level
  -- This is total_xp minus the XP required to reach current level
  v_xp_progress := CASE 
    WHEN v_gamification.xp_to_next_level > 0 THEN
      ((v_gamification.total_xp::NUMERIC / v_gamification.xp_to_next_level::NUMERIC) * 100)
    ELSE 0
  END;
  
  RETURN jsonb_build_object(
    'total_xp', v_gamification.total_xp,
    'current_level', v_gamification.current_level,
    'xp_to_next_level', v_gamification.xp_to_next_level,
    'xp_progress_percent', LEAST(v_xp_progress, 100),
    'current_streak', v_gamification.current_streak,
    'longest_streak', v_gamification.longest_streak,
    'title', v_gamification.title,
    'splits_created', v_gamification.splits_created,
    'splits_paid_on_time', v_gamification.splits_paid_on_time,
    'splits_completed_as_creator', v_gamification.splits_completed_as_creator,
    'total_amount_split', v_gamification.total_amount_split,
    'friends_referred', v_gamification.friends_referred,
    'badges', v_badges,
    'recent_xp', v_recent_xp
  );
END;
$$;

-- =============================================================================
-- Grant permissions to authenticated users
-- =============================================================================
GRANT EXECUTE ON FUNCTION initialize_user_gamification(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION award_xp(UUID, INTEGER, VARCHAR, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_gamification_stats(UUID, VARCHAR, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_streak(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION award_badge(UUID, VARCHAR, VARCHAR, TEXT, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_gamification(UUID) TO authenticated;

-- Grant service_role full access
GRANT ALL ON user_gamification TO service_role;
GRANT ALL ON xp_history TO service_role;
GRANT ALL ON user_badges TO service_role;
