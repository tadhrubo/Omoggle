-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 1: PROFILE EXPANSION — The Ego Engine
-- ═══════════════════════════════════════════════════════════════════════════

-- New combat statistics columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS highest_streak INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS peak_elo INTEGER DEFAULT 1200;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_mogs INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_mogged INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_views INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_ranked_at TIMESTAMPTZ DEFAULT NOW();

-- ═══════════════════════════════════════════════════════════════════════════
-- NEMESIS SYSTEM — Rivalry Tracking
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nemeses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nemesis_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT DEFAULT 'streak_breaker',
  match_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, nemesis_id)
);

ALTER TABLE nemeses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read nemeses" ON nemeses FOR SELECT USING (true);
CREATE POLICY "Anyone can insert nemeses" ON nemeses FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete nemeses" ON nemeses FOR DELETE USING (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_nemeses_user ON nemeses(user_id);
CREATE INDEX IF NOT EXISTS idx_nemeses_nemesis ON nemeses(nemesis_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- RPC: Atomic Post-Match Stats Update
-- Called by the client after each match to update streaks, mogs, peak ELO
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_post_match_stats(
  p_user_id UUID,
  p_new_elo INTEGER,
  p_is_winner BOOLEAN,
  p_mode TEXT DEFAULT 'casual'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_streak INTEGER;
  v_highest_streak INTEGER;
  v_peak_elo INTEGER;
  v_total_mogs INTEGER;
  v_total_mogged INTEGER;
  v_result JSONB;
BEGIN
  -- Get current stats
  SELECT current_streak, highest_streak, peak_elo, total_mogs, total_mogged
  INTO v_current_streak, v_highest_streak, v_peak_elo, v_total_mogs, v_total_mogged
  FROM profiles
  WHERE id = p_user_id;

  IF p_is_winner THEN
    v_current_streak := COALESCE(v_current_streak, 0) + 1;
    v_total_mogs := COALESCE(v_total_mogs, 0) + 1;
    IF v_current_streak > COALESCE(v_highest_streak, 0) THEN
      v_highest_streak := v_current_streak;
    END IF;
  ELSE
    v_current_streak := 0;
    v_total_mogged := COALESCE(v_total_mogged, 0) + 1;
  END IF;

  -- Track peak ELO
  IF p_new_elo > COALESCE(v_peak_elo, 1200) THEN
    v_peak_elo := p_new_elo;
  END IF;

  -- Update the profile atomically
  UPDATE profiles SET
    elo = CASE WHEN p_mode = 'ranked' THEN p_new_elo ELSE elo END,
    current_streak = v_current_streak,
    highest_streak = v_highest_streak,
    peak_elo = v_peak_elo,
    total_mogs = v_total_mogs,
    total_mogged = v_total_mogged,
    last_ranked_at = CASE WHEN p_mode = 'ranked' THEN NOW() ELSE last_ranked_at END
  WHERE id = p_user_id;

  v_result := jsonb_build_object(
    'current_streak', v_current_streak,
    'highest_streak', v_highest_streak,
    'peak_elo', v_peak_elo,
    'total_mogs', v_total_mogs,
    'total_mogged', v_total_mogged
  );

  RETURN v_result;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- RPC: Increment Profile Views (only for other viewers)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION increment_profile_views(p_profile_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET profile_views = COALESCE(profile_views, 0) + 1
  WHERE id = p_profile_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- AURA DECAY: Daily ELO drain for inactive high-tier players
-- Run via pg_cron or Supabase Edge Function daily
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION apply_aura_decay()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_affected INTEGER;
BEGIN
  UPDATE profiles
  SET elo = elo - 10
  WHERE elo >= 1900  -- CHAD tier and above
    AND last_ranked_at < NOW() - INTERVAL '7 days'
    AND elo - 10 >= 1000; -- Don't drop below MTN

  GET DIAGNOSTICS v_affected = ROW_COUNT;
  RETURN v_affected;
END;
$$;
