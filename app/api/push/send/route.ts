import { NextResponse } from "next/server";
import { formatHourKst } from "@/lib/date";
import {
  sendDueReminders,
  sendPushToAll,
  sendPushToUser,
  type PushPayload,
  type PushSubscriptionJSON,
} from "@/lib/push";
import { isPushSchedulerEnabled } from "@/lib/pushConfig";

export const runtime = "nodejs";

function isAuthorizedCron(req: Request): boolean {
  const auth = req.headers.get("authorization") || "";
  const cronSecret =
    process.env.CRON_SECRET || process.env.PUSH_CRON_SECRET || "";
  if (!cronSecret) return false;
  if (auth === `Bearer ${cronSecret}`) return true;
  if (req.headers.get("x-cron-secret") === cronSecret) return true;
  const url = new URL(req.url);
  if (url.searchParams.get("secret") === cronSecret) return true;
  return false;
}

function schedulerDisabledResponse() {
  return NextResponse.json(
    {
      ok: false,
      skipped: true,
      error:
        "Push scheduler disabled on this host (PUSH_SCHEDULER_ENABLED is not true). Enable it on the personal long-running server.",
    },
    { status: 503 }
  );
}

/**
 * Send free Web Push.
 * - Self test (always): { userId, title?, body?, subscription? }
 * - Scheduled broadcast: only when PUSH_SCHEDULER_ENABLED=true + CRON_SECRET
 */
export async function POST(req: Request) {
  try {
    const isCron = isAuthorizedCron(req);

    const body = (await req.json().catch(() => ({}))) as {
      userId?: string;
      title?: string;
      body?: string;
      url?: string;
      all?: boolean;
      dueOnly?: boolean;
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
      if (!isPushSchedulerEnabled()) {
        return schedulerDisabledResponse();
      }
      if (body.dueOnly === false) {
        const result = await sendPushToAll(payload);
        return NextResponse.json({ ok: true, mode: "all", ...result });
      }
      const result = await sendDueReminders(payload);
      return NextResponse.json({
        ok: true,
        mode: "due",
        schedule: `hourly filter KST ${formatHourKst(result.hour)}`,
        ...result,
      });
    }

    // Manual / self-test send — allowed on any host (Vercel or personal)
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

/** Scheduled tick (personal server cron / external scheduler). */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isPushSchedulerEnabled()) {
    return schedulerDisabledResponse();
  }

  try {
    const result = await sendDueReminders({
      title: "WordCatch",
      body: "복습 시간이에요! 오늘도 단어를 잡아볼까요?",
      url: "/review",
      tag: "wordcatch-daily",
    });
    return NextResponse.json({
      ok: true,
      schedule: `hourly · ${formatHourKst(result.hour)} KST`,
      ...result,
    });
  } catch (e) {
    console.error("GET /api/push/send", e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
