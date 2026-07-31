-- Idioms as { phrase, meaning } objects (JSONB).
-- Run once in Supabase SQL Editor.
-- Replaces an earlier TEXT[] idioms column if present.

ALTER TABLE wordcatch_words
  DROP COLUMN IF EXISTS idioms;

ALTER TABLE wordcatch_words
  ADD COLUMN idioms JSONB NOT NULL DEFAULT '[]'::jsonb;
