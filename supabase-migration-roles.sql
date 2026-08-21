-- Roles: super_admin | admin | user + admin roster (managed members)
-- Run after supabase-migration-admin.sql

-- 1) Role column (keeps is_admin in sync for older code paths)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin', 'admin', 'user'));

-- Backfill from is_admin if present
UPDATE users
SET role = 'admin'
WHERE COALESCE(is_admin, false) = true
  AND role = 'user';

-- Keep is_admin mirrored (optional compatibility)
UPDATE users SET is_admin = (role IN ('super_admin', 'admin'));

-- 2) Which members an admin can manage
CREATE TABLE IF NOT EXISTS wordcatch_admin_roster (
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (admin_id, user_id),
  CHECK (admin_id <> user_id)
);

CREATE INDEX IF NOT EXISTS idx_wc_roster_admin ON wordcatch_admin_roster(admin_id);
CREATE INDEX IF NOT EXISTS idx_wc_roster_user ON wordcatch_admin_roster(user_id);

ALTER TABLE wordcatch_admin_roster ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wc_roster_all" ON wordcatch_admin_roster;
CREATE POLICY "wc_roster_all" ON wordcatch_admin_roster
  FOR ALL USING (true) WITH CHECK (true);

-- Bootstrap one super admin (change the name):
-- UPDATE users SET role = 'super_admin', is_admin = true WHERE name = '당신이름';
