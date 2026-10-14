/**
 * Client-side data API. Same function names/signatures as before, but every call
 * goes to /api/wc, which uses the session user id (the userId argument is ignored
 * by the server and kept only so existing pages don't change).
 */
import type { ReviewLogRow, SourceRow, WordRow, WordStatus } from "@/lib/supabase";
import type { ReviewDirection, ReviewMode, TestType } from "@/lib/supabase";
import type {
  CreateWordInput,
  DateFilter,
  DayAccuracy,
  UpdateWordInput,
  WordFilters,
  WrongWordStat,
} from "@/lib/server/words";

export type { CreateWordInput, DateFilter, DayAccuracy, UpdateWordInput, WordFilters, WrongWordStat };

async function call<T>(op: string, ...args: unknown[]): Promise<T> {
  const res = await fetch("/api/wc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ op, args }),
  });
  const data = (await res.json().catch(() => ({}))) as { result?: T; error?: string };
  if (res.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new Event("wordcatch:unauthorized"));
  }
  if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
  return data.result as T;
}

export const listWords = (_userId: string, filters: WordFilters = {}) => call<WordRow[]>("listWords", filters);
export const getWord = (_userId: string, id: string) => call<WordRow | null>("getWord", id);
export const upsertSource = (_userId: string, name: string) => call<void>("upsertSource", name);
export const listSources = (_userId: string) => call<SourceRow[]>("listSources");
export const createWord = (_userId: string, input: CreateWordInput) => call<WordRow>("createWord", input);
export const updateWord = (_userId: string, id: string, input: UpdateWordInput) =>
  call<WordRow>("updateWord", id, input);
export const deleteWord = (_userId: string, id: string) => call<void>("deleteWord", id);
export const getStatusCounts = (_userId: string) =>
  call<Record<WordStatus, number> & { total: number; today: number }>("getStatusCounts");
export const recordReviewResult = (params: {
  userId: string;
  word: WordRow;
  isCorrect: boolean;
  mode: ReviewMode;
  testType?: TestType | null;
  direction?: ReviewDirection | null;
  userAnswer?: string | null;
}) => call<WordRow>("recordReviewResult", { ...params, userId: undefined });
export const getRecentAccuracy = (_userId: string, limit = 50) =>
  call<{ correct: number; total: number; rate: number }>("getRecentAccuracy", limit);
export const getRecentLogs = (_userId: string, limit = 30) => call<ReviewLogRow[]>("getRecentLogs", limit);
export const getDailyAccuracyTrend = (_userId: string, days = 7) =>
  call<DayAccuracy[]>("getDailyAccuracyTrend", days);
export const getTopWrongWords = (_userId: string, limit = 10) => call<WrongWordStat[]>("getTopWrongWords", limit);
export const getNotice = () => call<unknown>("getNotice");
