-- Unified Web Push subscriptions for all apps (WordCatch, ShortJapan, …)
-- Run once in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  app TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  remind_hour_kst INTEGER NOT NULL DEFAULT 19
    CHECK (remind_hour_kst >= 0 AND remind_hour_kst <= 23),
  last_notified_on DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (app, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subs_app_user
  ON push_subscriptions(app, user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_app_hour
  ON push_subscriptions(app, remind_hour_kst);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_subs_all" ON push_subscriptions;
CREATE POLICY "push_subs_all" ON push_subscriptions
  FOR ALL USING (true) WITH CHECK (true);

-- Migrate WordCatch (if old table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'wordcatch_push_subscriptions'
  ) THEN
    INSERT INTO push_subscriptions (
      app, user_id, endpoint, p256dh, auth,
      remind_hour_kst, last_notified_on, created_at, updated_at
    )
    SELECT
      'wordcatch',
      user_id,
      endpoint,
      p256dh,
      auth,
      COALESCE(remind_hour_kst, 19),
      last_notified_on,
      COALESCE(created_at, NOW()),
      COALESCE(updated_at, NOW())
    FROM wordcatch_push_subscriptions
    ON CONFLICT (app, endpoint) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      remind_hour_kst = EXCLUDED.remind_hour_kst,
      last_notified_on = EXCLUDED.last_notified_on,
      updated_at = EXCLUDED.updated_at;
  END IF;
END $$;

-- Migrate ShortJapan (if old table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'shortjapan_push_subscriptions'
  ) THEN
    INSERT INTO push_subscriptions (
      app, user_id, endpoint, p256dh, auth,
      remind_hour_kst, created_at, updated_at
    )
    SELECT
      'shortjapan',
      user_id,
      endpoint,
      p256dh,
      auth,
      19,
      COALESCE(created_at, NOW()),
      COALESCE(updated_at, NOW())
    FROM shortjapan_push_subscriptions
    ON CONFLICT (app, endpoint) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      updated_at = EXCLUDED.updated_at;
  END IF;
END $$;

-- Optional: drop old tables after verifying data
-- DROP TABLE IF EXISTS wordcatch_push_subscriptions;
-- DROP TABLE IF EXISTS shortjapan_push_subscriptions;
