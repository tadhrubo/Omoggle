-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 4: TELEMETRY & ADMINISTRATION FIXES
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. ANALYTICS EVENTS: Enable Row Level Security and configure permissive inserts
-- This fixes the RLS 401 error blocking client telemetry updates.
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public inserts" ON analytics_events;
CREATE POLICY "Allow public inserts" ON analytics_events FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read" ON analytics_events;
CREATE POLICY "Allow public read" ON analytics_events FOR SELECT USING (true);


-- 2. MATCHES DATABASE: Enable Row Level Security and configure permissive inserts/selects
-- This fixes the RLS 401 error when battles complete in the arena.
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  winner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  loser_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  winner_score NUMERIC DEFAULT 0,
  loser_score NUMERIC DEFAULT 0,
  elo_change INTEGER DEFAULT 0,
  mode TEXT DEFAULT 'casual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public matches inserts" ON matches;
CREATE POLICY "Allow public matches inserts" ON matches FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public matches select" ON matches;
CREATE POLICY "Allow public matches select" ON matches FOR SELECT USING (true);


-- 3. ADMINISTRATIVE MODERATION RPC (SECURITY DEFINER)
-- Allows the authenticated admin to toggle a player's ban status from the telemetry control panel
-- bypassing the restrictive profile owner-level policies.
CREATE OR REPLACE FUNCTION admin_set_ban_status(p_user_id UUID, p_is_banned BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET is_banned = p_is_banned
  WHERE id = p_user_id;
END;
$$;


-- 4. TELEMETRY OPTIMIZATION INDEXES
-- Index events by event_type and date ranges for lightning fast rendering on the chart scales
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created ON analytics_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_matches_created ON matches(created_at);
