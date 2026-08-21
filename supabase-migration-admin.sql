-- Admin flag on shared users + WordCatch app settings
-- Run in Supabase SQL Editor.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS wordcatch_app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE wordcatch_app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wc_settings_all" ON wordcatch_app_settings;
CREATE POLICY "wc_settings_all" ON wordcatch_app_settings
  FOR ALL USING (true) WITH CHECK (true);

INSERT INTO wordcatch_app_settings (key, value)
VALUES
  ('ai_enabled', 'false'::jsonb),
  ('ai_daily_limit', '20'::jsonb),
  ('notice_text', '""'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Bootstrap: set your admin account (change the name)
-- UPDATE users SET is_admin = true WHERE name = '당신이름';
