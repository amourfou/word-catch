import type { DbUser } from "@/lib/supabase";

export type UserRole = "super_admin" | "admin" | "user";

export function getUserRole(
  user: Pick<DbUser, "role" | "is_admin"> | null | undefined
): UserRole {
  const r = user?.role;
  if (r === "super_admin" || r === "admin" || r === "user") return r;
  // legacy
  if (user?.is_admin === true) return "admin";
  return "user";
}

export function canAccessAdmin(
  user: Pick<DbUser, "role" | "is_admin"> | null | undefined
): boolean {
  const role = getUserRole(user);
  return role === "super_admin" || role === "admin";
}

export function isSuperAdmin(
  user: Pick<DbUser, "role" | "is_admin"> | null | undefined
): boolean {
  return getUserRole(user) === "super_admin";
}

export function roleLabel(role: UserRole): string {
  if (role === "super_admin") return "슈퍼관리자";
  if (role === "admin") return "관리자";
  return "유저";
}
