-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  elo_score INTEGER DEFAULT 1000,
  tier TEXT DEFAULT 'Unranked',
  battles_won INTEGER DEFAULT 0,
  battles_lost INTEGER DEFAULT 0,
  is_premium BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create arena_queue table for WebRTC signaling
CREATE TABLE IF NOT EXISTS arena_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  peer_id TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'searching',
  target_peer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_queue ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public read access for profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Arena Queue policies - fully permissive for guest matchmaking
CREATE POLICY "Anyone can read arena_queue" ON arena_queue FOR SELECT USING (true);
CREATE POLICY "Anyone can insert arena_queue" ON arena_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update arena_queue" ON arena_queue FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete arena_queue" ON arena_queue FOR DELETE USING (true);

-- Enable Realtime for arena_queue
ALTER PUBLICATION supabase_realtime ADD TABLE arena_queue;