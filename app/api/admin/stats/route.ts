import { NextResponse } from "next/server";
import { getAdminCaller, readAdminUserId } from "@/lib/adminAuth";
import { seoulDateKey, startOfTodaySeoulIso } from "@/lib/date";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const adminUserId = readAdminUserId(req);
  const gate = await getAdminCaller(adminUserId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId")?.trim() || null;

  const { count: userCount } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true });

  let wordsQuery = supabase.from("wordcatch_words").select("status, user_id");
  if (userId) wordsQuery = wordsQuery.eq("user_id", userId);
  const { data: words } = await wordsQuery;

  const statusCounts = { unknown: 0, learning: 0, mastered: 0, total: 0 };
  const usersWithWords = new Set<string>();
  for (const w of words ?? []) {
    const s = w.status as keyof typeof statusCounts;
    if (s in statusCounts && s !== "total") statusCounts[s] += 1;
    statusCounts.total += 1;
    if (w.user_id) usersWithWords.add(w.user_id as string);
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let logsQuery = supabase
    .from("wordcatch_review_logs")
    .select("is_correct, reviewed_at, user_id")
    .gte("reviewed_at", since);
  if (userId) logsQuery = logsQuery.eq("user_id", userId);
  const { data: logs } = await logsQuery;

  let correct = 0;
  const activeUsers = new Set<string>();
  const byDay = new Map<string, { correct: number; total: number }>();
  for (const row of logs ?? []) {
    if (row.is_correct) correct += 1;
    if (row.user_id) activeUsers.add(row.user_id as string);
    const day = seoulDateKey(new Date(row.reviewed_at as string));
    const b = byDay.get(day) ?? { correct: 0, total: 0 };
    b.total += 1;
    if (row.is_correct) b.correct += 1;
    byDay.set(day, b);
  }
  const totalLogs = logs?.length ?? 0;

  let topWrongQuery = supabase
    .from("wordcatch_words")
    .select("id, word, wrong_count, status, user_id")
    .gt("wrong_count", 0)
    .order("wrong_count", { ascending: false })
    .limit(10);
  if (userId) topWrongQuery = topWrongQuery.eq("user_id", userId);
  const { data: topWrong } = await topWrongQuery;

  const todayIso = startOfTodaySeoulIso();
  let todayAddedQuery = supabase
    .from("wordcatch_words")
    .select("id", { count: "exact", head: true })
    .gte("created_at", todayIso);
  if (userId) todayAddedQuery = todayAddedQuery.eq("user_id", userId);
  const { count: todayAdded } = await todayAddedQuery;

  return NextResponse.json({
    ok: true,
    summary: {
      userCount: userCount ?? 0,
      usersWithWords: usersWithWords.size,
      activeReviewers7d: activeUsers.size,
      todayAdded: todayAdded ?? 0,
      words: statusCounts,
      recentReviews: totalLogs,
      recentAccuracy: totalLogs
        ? Math.round((correct / totalLogs) * 100)
        : 0,
    },
    daily: Array.from(byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, b]) => ({
        date,
        correct: b.correct,
        total: b.total,
        rate: b.total ? Math.round((b.correct / b.total) * 100) : 0,
      })),
    topWrong: topWrong ?? [],
  });
}
