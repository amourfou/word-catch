import { supabase, isAdminUser, type DbUser } from "@/lib/supabase";

export async function getAdminCaller(adminUserId: string | undefined | null): Promise<
  { ok: true; admin: DbUser } | { ok: false; status: number; error: string }
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
  if (!isAdminUser(admin)) {
    return { ok: false, status: 403, error: "관리자만 사용할 수 있어요." };
  }
  return { ok: true, admin };
}

export function readAdminUserId(req: Request, body?: { adminUserId?: string }): string | null {
  const header = req.headers.get("x-admin-user-id");
  if (header?.trim()) return header.trim();
  if (body?.adminUserId?.trim()) return body.adminUserId.trim();
  const url = new URL(req.url);
  const q = url.searchParams.get("adminUserId");
  return q?.trim() || null;
}
