import { NextResponse } from "next/server";
import {
  DEFAULT_REMIND_HOUR_KST,
  getRemindHourForUser,
  removePushSubscriptionForUser,
  savePushSubscription,
  updateRemindHourForUser,
  type PushSubscriptionJSON,
} from "@/lib/push";
import { assertSameOrigin, fail, readJson } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Push subscription for the logged-in user. The user id comes from the session
 * cookie; any userId in the body/query (older clients still send it) is ignored.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const me = await requireUser();
    const body = await readJson<{ subscription?: PushSubscriptionJSON; remindHourKst?: number }>(req);
    if (!body.subscription) {
      return NextResponse.json({ error: "subscription required" }, { status: 400 });
    }
    const hour = body.remindHourKst ?? DEFAULT_REMIND_HOUR_KST;
    const result = await savePushSubscription(me.id, body.subscription, hour);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, remindHourKst: hour });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: Request) {
  try {
    assertSameOrigin(req);
    const me = await requireUser();
    const body = await readJson<{ remindHourKst?: number }>(req);
    if (body.remindHourKst === undefined) {
      return NextResponse.json({ error: "remindHourKst required" }, { status: 400 });
    }
    const result = await updateRemindHourForUser(me.id, body.remindHourKst);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, remindHourKst: result.hour });
  } catch (e) {
    return fail(e);
  }
}

export async function GET() {
  try {
    const me = await requireUser();
    const { hour, hasSubscription } = await getRemindHourForUser(me.id);
    return NextResponse.json({
      ok: true,
      hasSubscription,
      remindHourKst: hour ?? DEFAULT_REMIND_HOUR_KST,
    });
  } catch (e) {
    return fail(e);
  }
}

/** Remove one of MY subscriptions by endpoint. */
export async function DELETE(req: Request) {
  try {
    assertSameOrigin(req);
    const me = await requireUser();
    const body = await readJson<{ endpoint?: string }>(req);
    if (!body.endpoint) {
      return NextResponse.json({ error: "endpoint required" }, { status: 400 });
    }
    await removePushSubscriptionForUser(me.id, body.endpoint);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
