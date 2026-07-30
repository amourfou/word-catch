import {
  seoulDateKey,
  startOfMonthSeoulIso,
  startOfTodaySeoulIso,
  startOfWeekSeoulIso,
} from "@/lib/date";
import { applyMasteryResult } from "@/lib/mastery";
import { supabase, type ReviewLogRow, type SourceRow, type WordRow, type WordStatus } from "@/lib/supabase";
import type { ReviewDirection, ReviewMode, TestType } from "@/lib/supabase";

export type DateFilter = "today" | "week" | "month" | "all";

export interface WordFilters {
  status?: WordStatus | "all";
  source?: string | "all";
  date?: DateFilter;
  search?: string;
}

export interface CreateWordInput {
  word: string;
  meanings: string[];
  part_of_speech?: string;
  source?: string;
  memo?: string;
}

export interface UpdateWordInput {
  word?: string;
  meanings?: string[];
  part_of_speech?: string | null;
  source?: string | null;
  memo?: string | null;
}

export async function listWords(
  userId: string,
  filters: WordFilters = {}
): Promise<WordRow[]> {
  let query = supabase
    .from("wordcatch_words")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters.source && filters.source !== "all") {
    query = query.eq("source", filters.source);
  }
  if (filters.date === "today") {
    query = query.gte("created_at", startOfTodaySeoulIso());
  } else if (filters.date === "week") {
    query = query.gte("created_at", startOfWeekSeoulIso());
  } else if (filters.date === "month") {
    query = query.gte("created_at", startOfMonthSeoulIso());
  }

  const { data, error } = await query;
  if (error) {
    console.error("listWords", error);
    throw error;
  }

  let rows = (data ?? []) as WordRow[];
  const q = filters.search?.trim().toLowerCase();
  if (q) {
    rows = rows.filter(
      (w) =>
        w.word.toLowerCase().includes(q) ||
        w.meanings.some((m) => m.toLowerCase().includes(q))
    );
  }
  return rows;
}

export async function getWord(userId: string, id: string): Promise<WordRow | null> {
  const { data, error } = await supabase
    .from("wordcatch_words")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("getWord", error);
    return null;
  }
  return data as WordRow | null;
}

export async function upsertSource(userId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const { error } = await supabase.from("wordcatch_sources").upsert(
    { user_id: userId, name: trimmed },
    { onConflict: "user_id,name" }
  );
  if (error) console.error("upsertSource", error);
}

export async function listSources(userId: string): Promise<SourceRow[]> {
  const { data, error } = await supabase
    .from("wordcatch_sources")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("listSources", error);
    return [];
  }
  return (data ?? []) as SourceRow[];
}

export async function createWord(
  userId: string,
  input: CreateWordInput
): Promise<WordRow> {
  const meanings = input.meanings.map((m) => m.trim()).filter(Boolean);
  if (!input.word.trim()) throw new Error("단어를 입력해 주세요.");
  if (meanings.length === 0) throw new Error("뜻을 하나 이상 입력해 주세요.");

  const source = input.source?.trim() || null;
  if (source) await upsertSource(userId, source);

  const { data, error } = await supabase
    .from("wordcatch_words")
    .insert([
      {
        user_id: userId,
        word: input.word.trim(),
        meanings,
        part_of_speech: input.part_of_speech?.trim() || null,
        source,
        memo: input.memo?.trim() || null,
        status: "unknown",
      },
    ])
    .select()
    .single();

  if (error || !data) {
    console.error("createWord", error);
    throw error ?? new Error("저장 실패");
  }
  return data as WordRow;
}

export async function updateWord(
  userId: string,
  id: string,
  input: UpdateWordInput
): Promise<WordRow> {
  const patch: Record<string, unknown> = {};
  if (input.word !== undefined) patch.word = input.word.trim();
  if (input.meanings !== undefined) {
    patch.meanings = input.meanings.map((m) => m.trim()).filter(Boolean);
  }
  if (input.part_of_speech !== undefined) {
    patch.part_of_speech = input.part_of_speech?.trim() || null;
  }
  if (input.source !== undefined) {
    const source = input.source?.trim() || null;
    patch.source = source;
    if (source) await upsertSource(userId, source);
  }
  if (input.memo !== undefined) patch.memo = input.memo?.trim() || null;

  const { data, error } = await supabase
    .from("wordcatch_words")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) {
    console.error("updateWord", error);
    throw error ?? new Error("수정 실패");
  }
  return data as WordRow;
}

export async function deleteWord(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from("wordcatch_words")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) {
    console.error("deleteWord", error);
    throw error;
  }
}

export async function getStatusCounts(
  userId: string
): Promise<Record<WordStatus, number> & { total: number; today: number }> {
  const { data, error } = await supabase
    .from("wordcatch_words")
    .select("status, created_at")
    .eq("user_id", userId);
  if (error) {
    console.error("getStatusCounts", error);
    return { unknown: 0, learning: 0, mastered: 0, total: 0, today: 0 };
  }
  const todayIso = startOfTodaySeoulIso();
  const counts = { unknown: 0, learning: 0, mastered: 0, total: 0, today: 0 };
  for (const row of data ?? []) {
    const s = row.status as WordStatus;
    if (s in counts) counts[s] += 1;
    counts.total += 1;
    if (row.created_at >= todayIso) counts.today += 1;
  }
  return counts;
}

export async function recordReviewResult(params: {
  userId: string;
  word: WordRow;
  isCorrect: boolean;
  mode: ReviewMode;
  testType?: TestType | null;
  direction?: ReviewDirection | null;
  userAnswer?: string | null;
}): Promise<WordRow> {
  const next = applyMasteryResult(
    {
      status: params.word.status,
      wrong_count: params.word.wrong_count,
      correct_streak: params.word.correct_streak,
    },
    params.isCorrect
  );

  const { data, error } = await supabase
    .from("wordcatch_words")
    .update({
      status: next.status,
      wrong_count: next.wrong_count,
      correct_streak: next.correct_streak,
      last_reviewed_at: new Date().toISOString(),
    })
    .eq("user_id", params.userId)
    .eq("id", params.word.id)
    .select()
    .single();

  if (error) console.error("recordReviewResult update", error);

  const { error: logError } = await supabase.from("wordcatch_review_logs").insert([
    {
      user_id: params.userId,
      word_id: params.word.id,
      mode: params.mode,
      test_type: params.testType ?? null,
      direction: params.direction ?? null,
      user_answer: params.userAnswer ?? null,
      is_correct: params.isCorrect,
    },
  ]);
  if (logError) console.error("recordReviewResult log", logError);

  return (data as WordRow) ?? { ...params.word, ...next };
}

export async function getRecentAccuracy(
  userId: string,
  limit = 50
): Promise<{ correct: number; total: number; rate: number }> {
  const { data, error } = await supabase
    .from("wordcatch_review_logs")
    .select("is_correct")
    .eq("user_id", userId)
    .order("reviewed_at", { ascending: false })
    .limit(limit);
  if (error || !data) return { correct: 0, total: 0, rate: 0 };
  const total = data.length;
  const correct = data.filter((r) => r.is_correct).length;
  return { correct, total, rate: total ? Math.round((correct / total) * 100) : 0 };
}

export async function getRecentLogs(
  userId: string,
  limit = 30
): Promise<ReviewLogRow[]> {
  const { data, error } = await supabase
    .from("wordcatch_review_logs")
    .select("*")
    .eq("user_id", userId)
    .order("reviewed_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as ReviewLogRow[];
}

export interface DayAccuracy {
  date: string; // YYYY-MM-DD (Seoul)
  correct: number;
  total: number;
  rate: number;
}

export interface WrongWordStat {
  wordId: string;
  word: string;
  wrongCount: number;
}

/** Last 7 KST calendar days of review accuracy (oldest → newest). */
export async function getDailyAccuracyTrend(
  userId: string,
  days = 7
): Promise<DayAccuracy[]> {
  // Start of (today - (days-1)) in KST
  const startToday = new Date(startOfTodaySeoulIso()).getTime();
  const sinceMs = startToday - (days - 1) * 24 * 60 * 60 * 1000;
  const sinceIso = new Date(sinceMs).toISOString();

  const { data, error } = await supabase
    .from("wordcatch_review_logs")
    .select("is_correct, reviewed_at")
    .eq("user_id", userId)
    .gte("reviewed_at", sinceIso)
    .order("reviewed_at", { ascending: true });

  const buckets = new Map<string, { correct: number; total: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const key = seoulDateKey(new Date(startToday - i * 24 * 60 * 60 * 1000));
    buckets.set(key, { correct: 0, total: 0 });
  }

  if (!error && data) {
    for (const row of data) {
      const key = seoulDateKey(new Date(row.reviewed_at));
      const b = buckets.get(key);
      if (!b) continue;
      b.total += 1;
      if (row.is_correct) b.correct += 1;
    }
  }

  return Array.from(buckets.entries()).map(([date, b]) => ({
    date,
    correct: b.correct,
    total: b.total,
    rate: b.total ? Math.round((b.correct / b.total) * 100) : 0,
  }));
}

/** Words with highest wrong_count for this user. */
export async function getTopWrongWords(
  userId: string,
  limit = 10
): Promise<WrongWordStat[]> {
  const { data, error } = await supabase
    .from("wordcatch_words")
    .select("id, word, wrong_count")
    .eq("user_id", userId)
    .gt("wrong_count", 0)
    .order("wrong_count", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => ({
    wordId: r.id as string,
    word: r.word as string,
    wrongCount: r.wrong_count as number,
  }));
}
