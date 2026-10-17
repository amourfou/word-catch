import { NextResponse } from "next/server";
import { seoulDateKey } from "@/lib/date";
import { markDuplicates } from "@/lib/photoWords";
import { supabase } from "@/lib/server/db";
import { ApiError, assertSameOrigin, fail } from "@/lib/server/http";
import { PHOTO_MAX_BYTES, extractWordsFromPhoto, sniffPhotoMime } from "@/lib/server/photoWordsAi";
import { requireUser } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * 사진 → 단어 후보 추출. 아무것도 DB에 저장하지 않는다(사진도 저장 안 함).
 * 저장은 검토 화면에서 기존 createWord 경로(/api/wc)로 한다.
 */

// 사용자별 하루 사용 횟수(메모리, 서버 재시작 시 초기화). DB 변경 없이 비용만 막는 용도.
const usage = new Map<string, { day: string; n: number }>();

async function readSettings(): Promise<{ enabled: boolean; limit: number }> {
  const { data } = await supabase
    .from("wordcatch_app_settings")
    .select("key, value")
    .in("key", ["ai_enabled", "ai_daily_limit"]);
  let enabled = false;
  let limit = 20;
  for (const row of data ?? []) {
    if (row.key === "ai_enabled") enabled = row.value === true || row.value === "true";
    if (row.key === "ai_daily_limit") {
      const n = Number(row.value);
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
    }
  }
  return { enabled, limit };
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireUser();

    const { enabled, limit } = await readSettings();
    if (!enabled) throw new ApiError(403, "관리자가 AI 기능을 아직 켜지 않았어요.");

    const day = seoulDateKey();
    const u = usage.get(user.id);
    const used = u && u.day === day ? u.n : 0;
    if (used >= limit) throw new ApiError(429, `오늘 사진 등록은 ${limit}번까지예요. 내일 다시 해 주세요.`);

    const form = await req.formData().catch(() => null);
    const file = form?.get("photo");
    if (!file || typeof file === "string") throw new ApiError(400, "사진을 골라 주세요.");
    if (file.size > PHOTO_MAX_BYTES) throw new ApiError(413, "사진이 너무 커요.");
    const buf = Buffer.from(await file.arrayBuffer());
    const mime = sniffPhotoMime(buf);
    if (!mime) throw new ApiError(415, "JPEG·PNG·WebP 사진만 돼요.");

    usage.set(user.id, { day, n: used + 1 });
    const { items, model } = await extractWordsFromPhoto(buf, mime);

    const { data: mine, error } = await supabase
      .from("wordcatch_words")
      .select("word")
      .eq("user_id", user.id);
    if (error) throw new ApiError(500, "내 단어장을 읽지 못했어요.");

    return NextResponse.json({
      items: markDuplicates(items, (mine ?? []).map((r) => r.word as string)),
      model,
      remaining: Math.max(0, limit - used - 1),
    });
  } catch (e) {
    return fail(e);
  }
}
