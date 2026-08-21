import { NextResponse } from "next/server";
import { getAdminCaller, readAdminUserId } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const adminUserId = readAdminUserId(req);
  const gate = await getAdminCaller(adminUserId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  let query = supabase
    .from("users")
    .select("id, name, organization, is_admin, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("admin users GET", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Word counts (best-effort)
  const ids = (data ?? []).map((u) => u.id as string);
  const countMap = new Map<string, number>();
  if (ids.length) {
    const { data: words } = await supabase
      .from("wordcatch_words")
      .select("user_id")
      .in("user_id", ids);
    for (const w of words ?? []) {
      const uid = w.user_id as string;
      countMap.set(uid, (countMap.get(uid) ?? 0) + 1);
    }
  }

  const users = (data ?? []).map((u) => ({
    ...u,
    is_admin: u.is_admin === true,
    wordCount: countMap.get(u.id as string) ?? 0,
  }));

  return NextResponse.json({ ok: true, users });
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    adminUserId?: string;
    userId?: string;
    is_admin?: boolean;
  };
  const adminUserId = readAdminUserId(req, body);
  const gate = await getAdminCaller(adminUserId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  if (!body.userId || typeof body.is_admin !== "boolean") {
    return NextResponse.json(
      { error: "userId and is_admin required" },
      { status: 400 }
    );
  }

  // Prevent removing the last admin
  if (body.is_admin === false) {
    const { data: admins } = await supabase
      .from("users")
      .select("id")
      .eq("is_admin", true);
    const adminIds = (admins ?? []).map((a) => a.id as string);
    if (adminIds.length <= 1 && adminIds.includes(body.userId)) {
      return NextResponse.json(
        { error: "마지막 관리자는 해제할 수 없어요." },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from("users")
    .update({ is_admin: body.is_admin, updated_at: new Date().toISOString() })
    .eq("id", body.userId)
    .select("id, name, organization, is_admin, created_at, updated_at")
    .single();

  if (error) {
    console.error("admin users PATCH", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, user: data });
}
