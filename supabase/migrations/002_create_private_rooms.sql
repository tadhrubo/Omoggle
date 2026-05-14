-- Private Rooms table for code-based matchmaking
CREATE TABLE IF NOT EXISTS private_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT NOT NULL,
  peer_id TEXT NOT NULL,
  elo INTEGER DEFAULT 1200,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast room code lookups
CREATE INDEX IF NOT EXISTS idx_private_rooms_code ON private_rooms(room_code);

-- Auto-cleanup: delete stale rooms older than 30 minutes
-- (Can be run as a cron job or pg_cron extension)

-- Enable Row Level Security
ALTER TABLE private_rooms ENABLE ROW LEVEL SECURITY;

-- Fully permissive policies (same pattern as arena_queue for guest support)
CREATE POLICY "Anyone can read private_rooms" ON private_rooms FOR SELECT USING (true);
CREATE POLICY "Anyone can insert private_rooms" ON private_rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update private_rooms" ON private_rooms FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete private_rooms" ON private_rooms FOR DELETE USING (true);

-- Enable Realtime for private_rooms (needed for opponent detection)
ALTER PUBLICATION supabase_realtime ADD TABLE private_rooms;
