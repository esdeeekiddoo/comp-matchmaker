-- Migration: Convert banners and bans columns to jsonb if they are text
-- Run in Supabase SQL editor or via psql against your DB

ALTER TABLE matches
  ALTER COLUMN banners TYPE jsonb USING banners::jsonb;

ALTER TABLE matches
  ALTER COLUMN bans TYPE jsonb USING bans::jsonb;

-- Note: If the columns already are jsonb, these statements will fail.
-- Verify column types first with:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'matches'
-- AND column_name IN ('banners', 'bans');
