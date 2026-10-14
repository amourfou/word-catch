import { seoulDateKey, seoulHour } from "@/lib/date";
import { supabase } from "@/lib/server/db";

/** '오늘의 단어' 알림용으로 고른 단어 */
export type WordOfDay = { word: string; meaning: string };

type Candidate = {
  user_id: string;
  word: string;
  meanings: string[] | null;
  status: string;
  wrong_count: number | null;
};

/** 문자열을 작은 정수로 바꾸는 간단한 해시 (날짜·시간별로 고르는 단어를 바꾸기 위함) */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const TOP_N = 10;

/**
 * 사용자마다 '모름' 상태이거나 자주 틀린 단어 중 하나를 고른다. (DB 읽기 전용)
 * 우선순위: 틀린 횟수 많은 순 → 모름 상태 순. 상위 10개 중 날짜+시간으로 하나 선택.
 * 고를 단어가 없거나 DB 오류면 그 사용자는 결과에 없다(기존 문구 사용).
 */
export async function pickWordsOfDay(
  userIds: string[]
): Promise<Map<string, WordOfDay>> {
  const result = new Map<string, WordOfDay>();
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return result;

  const { data, error } = await supabase
    .from("wordcatch_words")
    .select("user_id, word, meanings, status, wrong_count")
    .in("user_id", unique)
    .or("status.eq.unknown,wrong_count.gt.0")
    .limit(5000);

  if (error) {
    console.error("pickWordsOfDay", error.message);
    return result;
  }

  const byUser = new Map<string, Candidate[]>();
  for (const row of (data ?? []) as Candidate[]) {
    const meaning = (row.meanings ?? []).find((m) => m && m.trim());
    if (!row.word?.trim() || !meaning) continue;
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  const seed = `${seoulDateKey()}-${seoulHour()}`;
  for (const [userId, list] of Array.from(byUser.entries())) {
    list.sort(
      (a, b) =>
        (b.wrong_count ?? 0) - (a.wrong_count ?? 0) ||
        Number(b.status === "unknown") - Number(a.status === "unknown") ||
        a.word.localeCompare(b.word)
    );
    const top = list.slice(0, TOP_N);
    const pick = top[hash(`${seed}-${userId}`) % top.length];
    const meaning = (pick.meanings ?? []).find((m) => m && m.trim())!.trim();
    result.set(userId, { word: pick.word.trim(), meaning });
  }
  return result;
}

/** 알림 본문 문구 */
export function wordOfDayBody(w: WordOfDay): string {
  return `오늘의 단어: ${w.word} — ${w.meaning}\n눌러서 복습해 볼까요?`;
}
