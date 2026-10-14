import { NextResponse } from "next/server";
import {
  assertCanManageUser,
  getAdminCaller,
  getManagedUserIds,
} from "@/lib/server/adminAuth";
import { getUserRole, type UserRole } from "@/lib/roles";
import { supabase } from "@/lib/server/db";
import { ApiError } from "@/lib/server/http";
import { clearPinLock, setPin } from "@/lib/server/pin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function enrichUsers(rows: Record<string, unknown>[]) {
  const ids = rows.map((u) => u.id as string);
  const countMap = new Map<string, number>();
  const lastReviewMap = new Map<string, string>();
  const pinSet = new Set<string>();
  const lockedSet = new Set<string>();

  if (ids.length) {
    const { data: words } = await supabase
      .from("wordcatch_words")
      .select("user_id")
      .in("user_id", ids);
    for (const w of words ?? []) {
      const uid = w.user_id as string;
      countMap.set(uid, (countMap.get(uid) ?? 0) + 1);
    }

    const { data: pins, error: pinErr } = await supabase
      .from("user_pins")
      .select("user_id, locked_until")
      .in("user_id", ids);
    if (pinErr) console.warn("user_pins unavailable", pinErr.message);
    for (const p of pins ?? []) {
      pinSet.add(p.user_id as string);
      if (p.locked_until && Date.parse(p.locked_until as string) > Date.now()) lockedSet.add(p.user_id as string);
    }

    const { data: logs } = await supabase
      .from("wordcatch_review_logs")
      .select("user_id, reviewed_at")
      .in("user_id", ids)
      .order("reviewed_at", { ascending: false })
      .limit(3000);
    for (const row of logs ?? []) {
      const uid = row.user_id as string;
      if (!lastReviewMap.has(uid) && row.reviewed_at) {
        lastReviewMap.set(uid, row.reviewed_at as string);
      }
    }
  }

  return rows.map((u) => {
    const role = getUserRole({
      role: u.role as string | undefined,
      is_admin: u.is_admin as boolean | undefined,
    });
    return {
      id: u.id as string,
      name: u.name as string,
      organization: (u.organization as string) || "",
      role,
      is_admin: role === "admin" || role === "super_admin",
      created_at: u.created_at as string,
      updated_at: u.updated_at as string,
      wordCount: countMap.get(u.id as string) ?? 0,
      lastSeenAt: (u.updated_at as string) || null,
      lastReviewAt: lastReviewMap.get(u.id as string) ?? null,
      hasPin: pinSet.has(u.id as string),
      pinLocked: lockedSet.has(u.id as string),
    };
  });
}

export async function GET(req: Request) {
  const gate = await getAdminCaller();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const scope = url.searchParams.get("scope")?.trim() || "managed";
  // scope=managed (default): members an admin manages
  // scope=admins: all admin/super_admin users (super only)
  // scope=all: everyone (super only)

  const managedIds = await getManagedUserIds(gate.caller);

  if (scope === "admins" || scope === "all") {
    if (gate.caller.role !== "super_admin") {
      return NextResponse.json({ error: "슈퍼관리자만 가능해요." }, { status: 403 });
    }
  }

  let query = supabase
    .from("users")
    .select("id, name, organization, is_admin, role, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(300);

  if (q) {
    query = query.ilike("name", `%${q}%`);
  }

  if (scope === "admins") {
    query = query.in("role", ["admin", "super_admin"]);
  } else if (scope === "managed") {
    if (managedIds !== null) {
      if (managedIds.length === 0) {
        return NextResponse.json({
          ok: true,
          role: gate.caller.role,
          users: [],
        });
      }
      query = query.in("id", managedIds);
    }
  }

  const { data, error } = await query;
  if (error) {
    console.error("admin users GET", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const users = await enrichUsers((data ?? []) as Record<string, unknown>[]);
  return NextResponse.json({
    ok: true,
    role: gate.caller.role,
    users,
  });
}

/** Register a user under this admin's roster (admin/super). */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    organization?: string;
    /** Existing user id to link into roster (instead of create) */
    linkUserId?: string;
  };
  const gate = await getAdminCaller();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const adminId = gate.caller.admin.id;

  // Link existing user to this admin's roster
  if (body.linkUserId) {
    if (body.linkUserId === adminId) {
      return NextResponse.json(
        { error: "자기 자신은 등록할 수 없어요." },
        { status: 400 }
      );
    }
    const { data: target } = await supabase
      .from("users")
      .select("id, role, is_admin")
      .eq("id", body.linkUserId)
      .maybeSingle();
    if (!target) {
      return NextResponse.json({ error: "사용자를 찾을 수 없어요." }, { status: 404 });
    }
    const targetRole = getUserRole(target as { role?: string; is_admin?: boolean });
    if (targetRole !== "user") {
      return NextResponse.json(
        { error: "일반 유저만 관리 대상에 등록할 수 있어요." },
        { status: 400 }
      );
    }
    const { error } = await supabase.from("wordcatch_admin_roster").upsert({
      admin_id: adminId,
      user_id: body.linkUserId,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, linked: true, userId: body.linkUserId });
  }

  const name = body.name?.trim() ?? "";
  const organization = body.organization?.trim() ?? "";
  if (!name) {
    return NextResponse.json({ error: "이름을 입력해 주세요." }, { status: 400 });
  }
  if (!organization) {
    return NextResponse.json({ error: "소속을 입력해 주세요." }, { status: 400 });
  }
  if (name.length > 10) {
    return NextResponse.json({ error: "이름은 10자까지예요." }, { status: 400 });
  }
  if (organization.length > 15) {
    return NextResponse.json({ error: "소속은 15자까지예요." }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("users")
    .select("id, role, is_admin")
    .eq("name", name)
    .maybeSingle();

  if (existing) {
    // Auto-link existing plain user to this admin's roster
    const existingRole = getUserRole(
      existing as { role?: string; is_admin?: boolean }
    );
    if (existingRole !== "user") {
      return NextResponse.json(
        { error: "이미 관리자 등급인 이름이에요." },
        { status: 400 }
      );
    }
    const { error: linkErr } = await supabase.from("wordcatch_admin_roster").upsert({
      admin_id: adminId,
      user_id: existing.id,
    });
    if (linkErr) {
      return NextResponse.json({ error: linkErr.message }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      linked: true,
      userId: existing.id,
      message: "기존 유저를 관리 대상에 등록했어요.",
    });
  }

  const { data: created, error: createErr } = await supabase
    .from("users")
    .insert([
      {
        name,
        organization,
        high_score: 0,
        role: "user",
        is_admin: false,
      },
    ])
    .select("*")
    .single();

  if (createErr || !created) {
    return NextResponse.json(
      { error: createErr?.message || "등록 실패" },
      { status: 500 }
    );
  }

  const { error: rosterErr } = await supabase.from("wordcatch_admin_roster").insert({
    admin_id: adminId,
    user_id: created.id,
  });
  if (rosterErr) {
    return NextResponse.json({ error: rosterErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, created: true, user: created });
}

/** Super admin: set role. Admin: remove member from roster. */
export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    userId?: string;
    role?: UserRole;
    /** admin removes member from their roster */
    action?: "set_role" | "remove_from_roster" | "set_pin" | "unlock_pin";
    /** 6-digit PIN for set_pin. Never logged or echoed back. */
    pin?: string;
  };
  const gate = await getAdminCaller();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  if (!body.userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  if (body.action === "set_pin" || body.action === "unlock_pin") {
    const allowed = await assertCanManageUser(gate.caller, body.userId);
    if (!allowed.ok && body.userId !== gate.caller.admin.id) {
      return NextResponse.json({ error: allowed.error }, { status: allowed.status });
    }
    try {
      if (body.action === "unlock_pin") {
        await clearPinLock(body.userId);
        return NextResponse.json({ ok: true, unlocked: true });
      }
      await setPin(body.userId, String(body.pin ?? ""));
      return NextResponse.json({ ok: true, pinSet: true });
    } catch (e) {
      if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error("set_pin failed");
      return NextResponse.json({ error: "PIN 저장에 실패했어요." }, { status: 500 });
    }
  }

  if (body.action === "remove_from_roster") {
    const { error } = await supabase
      .from("wordcatch_admin_roster")
      .delete()
      .eq("admin_id", gate.caller.admin.id)
      .eq("user_id", body.userId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, removed: true });
  }

  // set_role — super_admin only
  if (gate.caller.role !== "super_admin") {
    return NextResponse.json(
      { error: "등급 변경은 슈퍼관리자만 가능해요." },
      { status: 403 }
    );
  }
  if (body.userId === gate.caller.admin.id) {
    return NextResponse.json({ error: "자기 자신의 등급은 바꿀 수 없어요." }, { status: 400 });
  }
  if (!body.role || !["super_admin", "admin", "user"].includes(body.role)) {
    return NextResponse.json({ error: "role required" }, { status: 400 });
  }

  if (body.role !== "super_admin") {
    const { data: supers } = await supabase
      .from("users")
      .select("id")
      .eq("role", "super_admin");
    const ids = (supers ?? []).map((s) => s.id as string);
    if (ids.length <= 1 && ids.includes(body.userId)) {
      return NextResponse.json(
        { error: "마지막 슈퍼관리자는 낮출 수 없어요." },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from("users")
    .update({
      role: body.role,
      is_admin: body.role === "admin" || body.role === "super_admin",
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.userId)
    .select("id, name, organization, role, is_admin, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, user: data });
}

