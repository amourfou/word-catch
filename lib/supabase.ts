import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface DbUser {
  id: string;
  name: string;
  organization: string;
  high_score: number;
  created_at: string;
  updated_at: string;
}

export type WordStatus = "unknown" | "learning" | "mastered";
export type ReviewMode = "flashcard" | "test";
export type TestType = "multiple_choice" | "direct_input";
export type ReviewDirection = "en_to_ko" | "ko_to_en";

export interface WordRow {
  id: string;
  user_id: string;
  word: string;
  meanings: string[];
  part_of_speech: string | null;
  source: string | null;
  memo: string | null;
  status: WordStatus;
  wrong_count: number;
  correct_streak: number;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewLogRow {
  id: string;
  user_id: string;
  word_id: string;
  mode: ReviewMode;
  test_type: TestType | null;
  direction: ReviewDirection | null;
  user_answer: string | null;
  is_correct: boolean | null;
  reviewed_at: string;
}

export interface SourceRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}
