-- ============================================================
-- Session 1: Multi-Guild Database Migration
-- Run this entire script in Supabase SQL Editor
-- ============================================================

-- 1. Create guild_config table (per-server settings)
CREATE TABLE IF NOT EXISTS guild_config (
  guild_id TEXT PRIMARY KEY,
  guild_name TEXT,
  game_name TEXT NOT NULL,
  host_role_id TEXT,
  results_channel_id TEXT,
  admin_role_id TEXT,
  starting_elo INTEGER DEFAULT 1000,
  k_factor INTEGER DEFAULT 32,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create guild_players table (per-server ELO/stats)
CREATE TABLE IF NOT EXISTS guild_players (
  discord_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  elo INTEGER DEFAULT 1000,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (discord_id, guild_id)
);

-- 3. Add active_guild_id to players (for cross-device guild persistence)
ALTER TABLE players ADD COLUMN IF NOT EXISTS active_guild_id TEXT;

-- 4. Seed CounterBlox guild config
INSERT INTO guild_config (guild_id, guild_name, game_name, host_role_id, results_channel_id, admin_role_id, starting_elo, k_factor)
VALUES (
  '1484564086074380311',
  'CounterBlox',
  'CounterBlox',
  '1520798037960822834',
  '1520800644099739705',
  '1521747164236349522',
  100,
  32
)
ON CONFLICT (guild_id) DO NOTHING;

-- 5. Migrate current ELO from players to guild_players
INSERT INTO guild_players (discord_id, guild_id, elo, wins, losses)
SELECT 
  discord_id, 
  '1484564086074380311', 
  elo, 
  wins, 
  losses
FROM players
WHERE discord_id IS NOT NULL
ON CONFLICT (discord_id, guild_id) DO NOTHING;

-- 6. Enable RLS for both tables (optional, follows existing pattern)
ALTER TABLE guild_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_players ENABLE ROW LEVEL SECURITY;

-- Allow anon key to read guild_config and guild_players
DROP POLICY IF EXISTS "Allow anon select guild_config" ON guild_config;
CREATE POLICY "Allow anon select guild_config" ON guild_config
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow anon select guild_players" ON guild_players;
CREATE POLICY "Allow anon select guild_players" ON guild_players
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow anon insert guild_config" ON guild_config;
CREATE POLICY "Allow anon insert guild_config" ON guild_config
  FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon upsert guild_players" ON guild_players;
CREATE POLICY "Allow anon upsert guild_players" ON guild_players
  FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow anon update guild_players" ON guild_players;
CREATE POLICY "Allow anon update guild_players" ON guild_players
  FOR UPDATE USING (true);

-- Verify
SELECT 'guild_config' as table_name, COUNT(*) as rows FROM guild_config
UNION ALL
SELECT 'guild_players', COUNT(*) FROM guild_players;
