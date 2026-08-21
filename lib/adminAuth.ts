import { getUserRole, canAccessAdmin, type UserRole } from "@/lib/roles";
import { supabase, type DbUser } from "@/lib/supabase";

export type AdminCaller = {
  admin: DbUser;
  role: UserRole;
};

export async function getAdminCaller(
  adminUserId: string | undefined | null
): Promise<
  { ok: true; caller: AdminCaller } | { ok: false; status: number; error: string }
> {
  if (!adminUserId?.trim()) {
    return { ok: false, status: 401, error: "adminUserId required" };
  }
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", adminUserId)
    .maybeSingle();
  if (error || !data) {
    return { ok: false, status: 401, error: "사용자를 찾을 수 없어요." };
  }
  const admin = data as DbUser;
  if (!canAccessAdmin(admin)) {
    return { ok: false, status: 403, error: "관리자만 사용할 수 있어요." };
  }
  return { ok: true, caller: { admin, role: getUserRole(admin) } };
}

export function readAdminUserId(
  req: Request,
  body?: { adminUserId?: string }
): string | null {
  const header = req.headers.get("x-admin-user-id");
  if (header?.trim()) return header.trim();
  if (body?.adminUserId?.trim()) return body.adminUserId.trim();
  const url = new URL(req.url);
  const q = url.searchParams.get("adminUserId");
  return q?.trim() || null;
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
