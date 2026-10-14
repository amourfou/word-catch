import "server-only";
import { getUserRole, canAccessAdmin, type UserRole } from "@/lib/roles";
import { supabase } from "@/lib/server/db";
import { ApiError } from "@/lib/server/http";
import { currentUser } from "@/lib/server/session";
import { type DbUser } from "@/lib/supabase";

export type AdminCaller = {
  admin: DbUser;
  role: UserRole;
};

/** Admin gate: signed session cookie + role read fresh from DB. No client-supplied ids. */
export async function getAdminCaller(_ignoredClientId?: unknown): Promise<
  { ok: true; caller: AdminCaller } | { ok: false; status: number; error: string }
> {
  void _ignoredClientId;
  try {
    const user = await currentUser();
    if (!user) return { ok: false, status: 401, error: "다시 로그인해 주세요." };
    if (!canAccessAdmin(user)) return { ok: false, status: 403, error: "관리자만 사용할 수 있어요." };
    return { ok: true, caller: { admin: user as DbUser, role: getUserRole(user) } };
  } catch (e) {
    // Let Next.js dynamic-rendering signals (cookies() during static analysis) propagate.
    if ((e as { digest?: string })?.digest === "DYNAMIC_SERVER_USAGE") throw e;
    if (e instanceof ApiError) return { ok: false, status: e.status, error: e.message };
    console.error("getAdminCaller", e);
    return { ok: false, status: 500, error: "서버 오류" };
  }
}

/** User IDs this admin may manage. null = unrestricted (super_admin). */
export async function getManagedUserIds(
  caller: AdminCaller
): Promise<string[] | null> {
  if (caller.role === "super_admin") return null;

  const { data, error } = await supabase
    .from("wordcatch_admin_roster")
    .select("user_id")
    .eq("admin_id", caller.admin.id);

  if (error) {
    console.error("getManagedUserIds", error);
    return [];
  }
  return (data ?? []).map((r) => r.user_id as string);
}

export async function assertCanManageUser(
  caller: AdminCaller,
  targetUserId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (caller.role === "super_admin") return { ok: true };
  const ids = await getManagedUserIds(caller);
  if (!ids || !ids.includes(targetUserId)) {
    return {
      ok: false,
      status: 403,
      error: "등록된 사용자만 관리할 수 있어요.",
    };
  }
  return { ok: true };
}

/**
 * @deprecated Client-supplied admin ids are ignored; kept so routes left as on
 * main (app/api/admin/push, owned by the push work) compile. Auth = session.
 */
export function readAdminUserId(_req?: Request, _body?: unknown): string | null {
  void _req;
  void _body;
  return null;
}
