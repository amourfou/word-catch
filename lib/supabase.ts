import { createClient } from "@supabase/supabase-js";

/**
 * Shared row types (client-safe).
 *
 * `supabase` (anon key) remains ONLY for the push notification modules
 * (lib/push.ts, app/api/push/*, app/api/admin/push), which are worked on
 * separately and intentionally left exactly as on main. All other data access
 * goes through server API routes using lib/server/db.ts (service role).
 * Do not import `supabase` from client components.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

let anonClient: SupabaseClient | null = null;

/**
 * Created on first use (not at import) so `next build` works in environments
 * without Supabase env vars (e.g. Vercel Preview). Same anon URL/key as before.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    if (!anonClient) {
      anonClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
      );
    }
    const c = anonClient as unknown as Record<string | symbol, unknown>;
    const v = c[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(anonClient) : v;
  },
});

export type UserRole = "super_admin" | "admin" | "user";

export interface DbUser {
  id: string;
  name: string;
  organization: string;
  high_score: number;
  /** @deprecated prefer role */
  is_admin?: boolean;
  role?: UserRole | string;
  created_at: string;
  updated_at: string;
}

/** Admin tab access: super_admin or admin */
export function isAdminUser(
  user: Pick<DbUser, "is_admin" | "role"> | null | undefined
): boolean {
  if (user?.role === "super_admin" || user?.role === "admin") return true;
  return user?.is_admin === true;
}

export type WordStatus = "unknown" | "learning" | "mastered";
export type ReviewMode = "flashcard" | "test";
export type TestType = "multiple_choice" | "direct_input";
export type ReviewDirection = "en_to_ko" | "ko_to_en" | "listen_to_ko";

export interface WordIdiom {
  phrase: string;
  meaning: string;
}

export interface DictionaryRow {
  id: string;
  word_key: string;
  word: string;
  phonetic: string | null;
  audio_url: string | null;
  entry: unknown;
  raw: unknown;
  source: string | null;
  learner_user_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface WordRow {
  id: string;
  user_id: string;
  dictionary_id: string | null;
  word: string;
  meanings: string[];
  part_of_speech: string | null;
  phonetic: string | null;
  audio_url: string | null;
  source: string | null;
  idioms: WordIdiom[];
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
