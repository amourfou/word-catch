import { NextResponse } from "next/server";
import {
  DEFAULT_REMIND_HOUR_KST,
  getRemindHourForUser,
  removePushSubscription,
  savePushSubscription,
  updateRemindHourForUser,
  type PushSubscriptionJSON,
} from "@/lib/push";

export const runtime = "nodejs";

/** Save browser push subscription for a user. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      userId?: string;
      subscription?: PushSubscriptionJSON;
      remindHourKst?: number;
    };
    if (!body.userId || !body.subscription) {
      return NextResponse.json(
        { error: "userId and subscription required" },
        { status: 400 }
      );
    }
    const result = await savePushSubscription(
      body.userId,
      body.subscription,
      body.remindHourKst ?? DEFAULT_REMIND_HOUR_KST
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      remindHourKst: body.remindHourKst ?? DEFAULT_REMIND_HOUR_KST,
    });
  } catch (e) {
    console.error("POST /api/push/subscribe", e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

/** Update remind hour for all of a user's subscriptions. */
export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as {
      userId?: string;
      remindHourKst?: number;
    };
    if (!body.userId || body.remindHourKst === undefined) {
      return NextResponse.json(
        { error: "userId and remindHourKst required" },
        { status: 400 }
      );
    }
    const result = await updateRemindHourForUser(body.userId, body.remindHourKst);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, remindHourKst: result.hour });
  } catch (e) {
    console.error("PATCH /api/push/subscribe", e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

/** Load saved remind hour for user. */
export async function GET(req: Request) {
  try {
    const userId = new URL(req.url).searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }
    const { hour, hasSubscription } = await getRemindHourForUser(userId);
    return NextResponse.json({
      ok: true,
      hasSubscription,
      remindHourKst: hour ?? DEFAULT_REMIND_HOUR_KST,
    });
  } catch (e) {
    console.error("GET /api/push/subscribe", e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

/** Remove subscription by endpoint */
export async function DELETE(req: Request) {
  try {
    const body = (await req.json()) as { endpoint?: string };
    if (!body.endpoint) {
      return NextResponse.json({ error: "endpoint required" }, { status: 400 });
    }
    await removePushSubscription(body.endpoint);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/push/subscribe", e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
