import { NextResponse } from "next/server";
import {
  assertCanManageUser,
  getAdminCaller,
  getManagedUserIds,
} from "@/lib/server/adminAuth";
import { sendPushToUser } from "@/lib/push";
import { supabase } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await getAdminCaller();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const managedIds = await getManagedUserIds(gate.caller);
  if (managedIds !== null && managedIds.length === 0) {
    return NextResponse.json({
      ok: true,
      total: 0,
      byHour: [],
      subscriptions: [],
    });
  }

  let query = supabase
    .from("push_subscriptions")
    .select(
      "id, user_id, endpoint, remind_hour_kst, last_notified_on, updated_at, created_at"
    )
    .eq("app", "wordcatch")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (managedIds) {
    query = query.in("user_id", managedIds);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const userIds = Array.from(
    new Set((data ?? []).map((r) => r.user_id as string).filter(Boolean))
  );
  const nameMap = new Map<string, string>();
  if (userIds.length) {
    const { data: users } = await supabase
      .from("users")
      .select("id, name")
      .in("id", userIds);
    for (const u of users ?? []) {
      nameMap.set(u.id as string, u.name as string);
    }
  }

  const byHour = new Map<number, number>();
  const rows = (data ?? []).map((r) => {
    const hour = Number(r.remind_hour_kst ?? 19);
    byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
    let host = "";
    try {
      host = new URL(r.endpoint as string).host;
    } catch {
      host = "(invalid)";
    }
    return {
      ...r,
      userName: nameMap.get(r.user_id as string) ?? "(unknown)",
      endpointHost: host,
    };
  });

  return NextResponse.json({
    ok: true,
    total: rows.length,
    byHour: Array.from(byHour.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([hour, count]) => ({ hour, count })),
    subscriptions: rows,
  });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    userId?: string;
  };
  const gate = await getAdminCaller();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  if (!body.userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const allowed = await assertCanManageUser(gate.caller, body.userId);
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  }

  const result = await sendPushToUser(body.userId, {
    // Fixed template: admins cannot send arbitrary text or links to a child's device.
    title: "WordCatch",
    body: "복습할 시간이에요! 테스트 한 번 해볼까요?",
    url: "/review",
    tag: "wordcatch-admin-nudge",
  });

  if (result.sent === 0) {
    return NextResponse.json(
      { ok: false, error: result.details[0] || "전송 실패", ...result },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, ...result });
}
