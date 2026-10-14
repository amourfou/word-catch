import { NextResponse } from "next/server";
import { getAdminCaller } from "@/lib/server/adminAuth";
import { supabase } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEYS = ["ai_enabled", "ai_daily_limit", "notice_text"] as const;

export async function GET(req: Request) {
  const gate = await getAdminCaller();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  // Both admin and super_admin can view settings

  const { data, error } = await supabase
    .from("wordcatch_app_settings")
    .select("key, value, updated_at");

  if (error) {
    // Table may not exist yet
    return NextResponse.json({
      ok: true,
      settings: {
        ai_enabled: false,
        ai_daily_limit: 20,
        notice_text: "",
      },
      warning: error.message,
    });
  }

  const settings: Record<string, unknown> = {
    ai_enabled: false,
    ai_daily_limit: 20,
    notice_text: "",
  };
  for (const row of data ?? []) {
    settings[row.key as string] = row.value;
  }

  return NextResponse.json({ ok: true, settings });
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    settings?: Record<string, unknown>;
  };
  const gate = await getAdminCaller();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  if (gate.caller.role !== "super_admin") {
    return NextResponse.json(
      { error: "시스템 설정 변경은 슈퍼관리자만 가능해요." },
      { status: 403 }
    );
  }
  if (!body.settings || typeof body.settings !== "object") {
    return NextResponse.json({ error: "settings required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const rows = KEYS.filter((k) => k in (body.settings ?? {})).map((key) => ({
    key,
    value: body.settings![key] as unknown,
    updated_at: now,
  }));

  if (rows.length === 0) {
    return NextResponse.json({ error: "no known settings" }, { status: 400 });
  }

  const { error } = await supabase.from("wordcatch_app_settings").upsert(rows, {
    onConflict: "key",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
