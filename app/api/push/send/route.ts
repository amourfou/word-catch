import { NextResponse } from "next/server";
import {
  sendPushToAll,
  sendPushToUser,
  type PushPayload,
  type PushSubscriptionJSON,
} from "@/lib/push";

export const runtime = "nodejs";

/**
 * Send free Web Push.
 * - Self test: { userId, title?, body?, subscription? }
 * - Broadcast (cron): Authorization: Bearer CRON_SECRET
 */
export async function POST(req: Request) {
  try {
    const auth = req.headers.get("authorization") || "";
    const cronSecret =
      process.env.CRON_SECRET || process.env.PUSH_CRON_SECRET || "";
    const isCron =
      !!cronSecret &&
      (auth === `Bearer ${cronSecret}` ||
        req.headers.get("x-cron-secret") === cronSecret);

    const body = (await req.json().catch(() => ({}))) as {
      userId?: string;
      title?: string;
      body?: string;
      url?: string;
      all?: boolean;
      /** Live browser subscription — used for test even if DB empty */
      subscription?: PushSubscriptionJSON;
    };

    const payload: PushPayload = {
      title: body.title || "WordCatch",
      body: body.body || "오늘도 단어를 잡아볼까요?",
      url: body.url || "/review",
      tag: "wordcatch-remind",
    };

    if (isCron || body.all) {
      if (!isCron) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      const result = await sendPushToAll(payload);
      return NextResponse.json({ ok: true, ...result });
    }

    if (!body.userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const result = await sendPushToUser(
      body.userId,
      payload,
      body.subscription ?? null
    );

    if (result.sent === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            result.details[0] ||
            "전송된 기기가 없어요. 알림을 다시 켜 보거나 VAPID 키·DB 테이블을 확인하세요.",
          ...result,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("POST /api/push/send", e);
    const msg = e instanceof Error ? e.message : "server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Vercel Cron can hit GET with Authorization header */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const cronSecret =
    process.env.CRON_SECRET || process.env.PUSH_CRON_SECRET || "";
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    const url = new URL(req.url);
    if (!cronSecret || url.searchParams.get("secret") !== cronSecret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    // Cron: 10:00 UTC = 19:00 KST (매일 저녁 7시)
    const result = await sendPushToAll({
      title: "WordCatch",
      body: "저녁 복습 시간이에요! 오늘도 단어를 잡아볼까요?",
      url: "/review",
      tag: "wordcatch-daily",
    });
    return NextResponse.json({
      ok: true,
      schedule: "daily 19:00 KST",
      ...result,
    });
  } catch (e) {
    console.error("GET /api/push/send", e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
