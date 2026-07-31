-- Audio URL for pronunciation playback + listen_to_ko review direction.
-- Run once in Supabase SQL Editor.

ALTER TABLE wordcatch_words
  ADD COLUMN IF NOT EXISTS audio_url TEXT;

ALTER TABLE wordcatch_review_logs
  DROP CONSTRAINT IF EXISTS wordcatch_review_logs_direction_check;

ALTER TABLE wordcatch_review_logs
  ADD CONSTRAINT wordcatch_review_logs_direction_check
  CHECK (
    direction IS NULL
    OR direction IN ('en_to_ko', 'ko_to_en', 'listen_to_ko')
  );
