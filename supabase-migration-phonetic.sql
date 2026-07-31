-- Add IPA / pronunciation field to existing WordCatch words table.
-- Run once in Supabase SQL Editor.

ALTER TABLE wordcatch_words
  ADD COLUMN IF NOT EXISTS phonetic TEXT;
