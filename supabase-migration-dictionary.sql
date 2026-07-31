-- Shared dictionary cache (API results + learners) and per-user word uniqueness.
-- Run once in Supabase SQL Editor.

-- 1. Global dictionary cache
CREATE TABLE IF NOT EXISTS wordcatch_dictionary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  word_key TEXT NOT NULL UNIQUE,
  word TEXT NOT NULL,
  phonetic TEXT,
  audio_url TEXT,
  entry JSONB,
  raw JSONB,
  source TEXT,
  learner_user_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wc_dictionary_word_key
  ON wordcatch_dictionary(word_key);

ALTER TABLE wordcatch_dictionary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wc_dictionary_all" ON wordcatch_dictionary;
CREATE POLICY "wc_dictionary_all" ON wordcatch_dictionary
  FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_wc_dictionary_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wc_dictionary_updated ON wordcatch_dictionary;
CREATE TRIGGER trg_wc_dictionary_updated
  BEFORE UPDATE ON wordcatch_dictionary
  FOR EACH ROW EXECUTE FUNCTION update_wc_dictionary_updated_at();

-- 2. Optional link from user words → dictionary
ALTER TABLE wordcatch_words
  ADD COLUMN IF NOT EXISTS dictionary_id UUID
    REFERENCES wordcatch_dictionary(id) ON DELETE SET NULL;

-- 3. Deduplicate existing user words (keep newest per user + lower(word))
DELETE FROM wordcatch_words w
USING wordcatch_words newer
WHERE w.user_id = newer.user_id
  AND lower(w.word) = lower(newer.word)
  AND w.created_at < newer.created_at;

DELETE FROM wordcatch_words w
USING wordcatch_words keep
WHERE w.user_id = keep.user_id
  AND lower(w.word) = lower(keep.word)
  AND w.id < keep.id
  AND w.created_at = keep.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wc_words_user_word_lower
  ON wordcatch_words (user_id, lower(word));
