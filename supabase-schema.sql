-- WordCatch tables (public schema, shares existing `users` with HaanRiver / ShortJapan)
-- Run in Supabase SQL Editor. Do NOT create `users`.

-- 1. Shared dictionary cache (user-agnostic API results + learners)
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

-- 2. Words (per-user study list)
CREATE TABLE IF NOT EXISTS wordcatch_words (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dictionary_id UUID REFERENCES wordcatch_dictionary(id) ON DELETE SET NULL,
  word TEXT NOT NULL,
  meanings TEXT[] NOT NULL,
  part_of_speech TEXT,
  phonetic TEXT,
  audio_url TEXT,
  source TEXT,
  idioms JSONB NOT NULL DEFAULT '[]'::jsonb,
  memo TEXT,
  status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('unknown', 'learning', 'mastered')),
  wrong_count INTEGER NOT NULL DEFAULT 0,
  correct_streak INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Review logs
CREATE TABLE IF NOT EXISTS wordcatch_review_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES wordcatch_words(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('flashcard', 'test')),
  test_type TEXT CHECK (test_type IS NULL OR test_type IN ('multiple_choice', 'direct_input')),
  direction TEXT CHECK (direction IS NULL OR direction IN ('en_to_ko', 'ko_to_en', 'listen_to_ko')),
  user_answer TEXT,
  is_correct BOOLEAN,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Sources (reuse previous source names)
CREATE TABLE IF NOT EXISTS wordcatch_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_wc_dictionary_word_key
  ON wordcatch_dictionary(word_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wc_words_user_word_lower
  ON wordcatch_words (user_id, lower(word));
CREATE INDEX IF NOT EXISTS idx_wc_words_user_created
  ON wordcatch_words(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wc_words_user_status
  ON wordcatch_words(user_id, status);
CREATE INDEX IF NOT EXISTS idx_wc_words_user_source
  ON wordcatch_words(user_id, source);
CREATE INDEX IF NOT EXISTS idx_wc_logs_user_reviewed
  ON wordcatch_review_logs(user_id, reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_wc_sources_user
  ON wordcatch_sources(user_id);

ALTER TABLE wordcatch_dictionary ENABLE ROW LEVEL SECURITY;
ALTER TABLE wordcatch_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE wordcatch_review_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wordcatch_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wc_dictionary_all" ON wordcatch_dictionary;
DROP POLICY IF EXISTS "wc_words_all" ON wordcatch_words;
DROP POLICY IF EXISTS "wc_logs_all" ON wordcatch_review_logs;
DROP POLICY IF EXISTS "wc_sources_all" ON wordcatch_sources;

CREATE POLICY "wc_dictionary_all" ON wordcatch_dictionary FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "wc_words_all" ON wordcatch_words FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "wc_logs_all" ON wordcatch_review_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "wc_sources_all" ON wordcatch_sources FOR ALL USING (true) WITH CHECK (true);

-- 5. Web Push subscriptions (free VAPID / browser push)
CREATE TABLE IF NOT EXISTS wordcatch_push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wc_push_user ON wordcatch_push_subscriptions(user_id);

ALTER TABLE wordcatch_push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wc_push_all" ON wordcatch_push_subscriptions;
CREATE POLICY "wc_push_all" ON wordcatch_push_subscriptions FOR ALL USING (true) WITH CHECK (true);

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

CREATE OR REPLACE FUNCTION update_wc_words_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_wc_words_updated ON wordcatch_words;
CREATE TRIGGER trg_wc_words_updated
  BEFORE UPDATE ON wordcatch_words
  FOR EACH ROW EXECUTE FUNCTION update_wc_words_updated_at();
