import { NextResponse } from "next/server";
import {
  removePushSubscription,
  savePushSubscription,
  type PushSubscriptionJSON,
} from "@/lib/push";

export const runtime = "nodejs";

/** Save browser push subscription for a user (free Web Push). */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      userId?: string;
      subscription?: PushSubscriptionJSON;
    };
    if (!body.userId || !body.subscription) {
      return NextResponse.json(
        { error: "userId and subscription required" },
        { status: 400 }
      );
    }
    const result = await savePushSubscription(body.userId, body.subscription);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/push/subscribe", e);
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
