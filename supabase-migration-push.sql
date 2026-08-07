-- Web Push subscriptions for WordCatch (free VAPID / browser push)
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS wordcatch_push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  remind_hour_kst INTEGER NOT NULL DEFAULT 19
    CHECK (remind_hour_kst >= 0 AND remind_hour_kst <= 23),
  last_notified_on DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wc_push_user ON wordcatch_push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_wc_push_remind_hour ON wordcatch_push_subscriptions(remind_hour_kst);

ALTER TABLE wordcatch_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wc_push_all" ON wordcatch_push_subscriptions;
CREATE POLICY "wc_push_all" ON wordcatch_push_subscriptions FOR ALL USING (true) WITH CHECK (true);
