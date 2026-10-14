import { NextResponse } from "next/server";
import { supabase } from "@/lib/server/db";
import * as words from "@/lib/server/words";
import { ApiError, assertSameOrigin, fail, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Single data endpoint for the learner screens. The user id ALWAYS comes from
 * the signed session cookie; any userId the client sends is ignored.
 * Each op calls the same functions the app used before (same tables, same columns).
 */
type Args = unknown[];
const str = (v: unknown, name: string): string => {
  if (typeof v !== "string" || !v) throw new ApiError(400, `${name} required`);
  return v;
};
const num = (v: unknown, d: number, max: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(1, Math.min(max, Math.floor(v))) : d;

const OPS: Record<string, (uid: string, a: Args) => Promise<unknown>> = {
  listWords: (uid, a) => words.listWords(uid, (a[0] ?? {}) as words.WordFilters),
  getWord: (uid, a) => words.getWord(uid, str(a[0], "id")),
  upsertSource: (uid, a) => words.upsertSource(uid, str(a[0], "name")),
  listSources: (uid) => words.listSources(uid),
  createWord: (uid, a) => words.createWord(uid, (a[0] ?? {}) as words.CreateWordInput),
  updateWord: (uid, a) => words.updateWord(uid, str(a[0], "id"), (a[1] ?? {}) as words.UpdateWordInput),
  deleteWord: (uid, a) => words.deleteWord(uid, str(a[0], "id")),
  getStatusCounts: (uid) => words.getStatusCounts(uid),
  recordReviewResult: async (uid, a) => {
    const p = (a[0] ?? {}) as Parameters<typeof words.recordReviewResult>[0];
    // Re-read the word server-side so mastery is computed from stored values of the caller's own word.
    const stored = await words.getWord(uid, str(p.word?.id, "word.id"));
    if (!stored) throw new ApiError(404, "단어를 찾을 수 없어요.");
    return words.recordReviewResult({ ...p, userId: uid, word: stored, isCorrect: p.isCorrect === true });
  },
  getRecentAccuracy: (uid, a) => words.getRecentAccuracy(uid, num(a[0], 50, 500)),
  getRecentLogs: (uid, a) => words.getRecentLogs(uid, num(a[0], 30, 500)),
  getDailyAccuracyTrend: (uid, a) => words.getDailyAccuracyTrend(uid, num(a[0], 7, 90)),
  // Home-screen notice set by admins (wordcatch_app_settings.key = 'notice_text'), read-only.
  getNotice: async () => {
    const { data } = await supabase
      .from("wordcatch_app_settings")
      .select("value")
      .eq("key", "notice_text")
      .maybeSingle();
    return data?.value ?? null;
  },
  getTopWrongWords: (uid, a) => words.getTopWrongWords(uid, num(a[0], 10, 100)),
};

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireUser();
    const body = await readJson<{ op?: string; args?: Args }>(req);
    const fn = body.op ? OPS[body.op] : undefined;
    if (!fn) throw new ApiError(400, "unknown op");
    const result = await fn(user.id, Array.isArray(body.args) ? body.args : []);
    return NextResponse.json({ result: result ?? null });
  } catch (e) {
    if (e instanceof Error && !(e instanceof ApiError) && /단어|뜻|이미/.test(e.message)) {
      // user-facing validation errors thrown by lib/server/words (e.g. "단어를 입력해 주세요")
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return fail(e);
  }
}
