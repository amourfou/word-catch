import crypto from "crypto";
import { NextResponse } from "next/server";
import { formatHourKst } from "@/lib/date";
import {
  sendDueReminders,
  sendPushToAll,
  sendPushToUser,
  type PushPayload,
} from "@/lib/push";
import { isPushSchedulerEnabled } from "@/lib/pushConfig";
import { currentUser } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Cron auth: `Authorization: Bearer <CRON_SECRET>` only (no query string, no x-cron-secret). */
function isAuthorizedCron(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET || process.env.PUSH_CRON_SECRET || "";
  if (!cronSecret) return false;
  const auth = req.headers.get("authorization") || "";
  const expected = Buffer.from(`Bearer ${cronSecret}`);
  const given = Buffer.from(auth);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

/** Fixed notification templates. Clients pick a template id; they cannot send free text or links. */
const TEMPLATES = {
  test: { title: "WordCatch", body: "알림이 잘 와요! 오늘도 단어 잡으러 가 볼까요?", url: "/review" },
  due: { title: "WordCatch", body: "오늘도 단어를 잡아볼까요?", url: "/review" },
} as const;
type TemplateId = keyof typeof TEMPLATES;

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
 * Send free Web Push (fixed templates only).
 * - Self test: logged-in session → own devices, "test" template.
 * - Scheduled broadcast: `Authorization: Bearer CRON_SECRET` + PUSH_SCHEDULER_ENABLED=true
 */
export async function POST(req: Request) {
  try {
    const isCron = isAuthorizedCron(req);

    const body = (await req.json().catch(() => ({}))) as {
      template?: string;
      all?: boolean;
      dueOnly?: boolean;
    };

    const templateId: TemplateId = body.template === "test" ? "test" : "due";
    const payload: PushPayload = { ...TEMPLATES[templateId], tag: "wordcatch-remind" };

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

    // Self-test: only to the logged-in user's own devices, fixed "test" template.
    const me = await currentUser();
    if (!me) {
      return NextResponse.json({ error: "다시 로그인해 주세요." }, { status: 401 });
    }

    const result = await sendPushToUser(
      me.id,
      { ...TEMPLATES.test, tag: "wordcatch-test" },
      null
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
      ...TEMPLATES.due,
      body: "복습 시간이에요! 오늘도 단어를 잡아볼까요?",
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
