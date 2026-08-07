-- Per-user review reminder hour (KST) + daily de-dupe
-- Run in Supabase SQL Editor after supabase-migration-push.sql

ALTER TABLE wordcatch_push_subscriptions
  ADD COLUMN IF NOT EXISTS remind_hour_kst INTEGER NOT NULL DEFAULT 19
    CHECK (remind_hour_kst >= 0 AND remind_hour_kst <= 23);

ALTER TABLE wordcatch_push_subscriptions
  ADD COLUMN IF NOT EXISTS last_notified_on DATE;

CREATE INDEX IF NOT EXISTS idx_wc_push_remind_hour
  ON wordcatch_push_subscriptions(remind_hour_kst);
