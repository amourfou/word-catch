/**
 * Client auth helpers. The real session is an HttpOnly signed cookie set by
 * /api/session; localStorage only remembers the last name typed (for convenience)
 * and a non-secret display cache.
 */
import type { DbUser } from "@/lib/supabase";

const STORAGE_KEY = "wordcatch-user";
const LAST_NAME_KEY = "wordcatch-last-name";

export interface StoredSession {
  id: string;
  name: string;
  organization: string;
  savedAt: string;
}

export function getStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed?.id ? parsed : null;
  } catch {
    return null;
  }
}

export function getStoredUserId(): string | null {
  return getStoredSession()?.id ?? null;
}

export function saveUserSession(user: Pick<DbUser, "id" | "name" | "organization">): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ id: user.id, name: user.name, organization: user.organization ?? "", savedAt: new Date().toISOString() })
    );
    localStorage.setItem(LAST_NAME_KEY, user.name);
  } catch {
    /* ignore */
  }
}

export function clearUserSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function getLastName(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(LAST_NAME_KEY) || getStoredSession()?.name || "";
  } catch {
    return "";
  }
}

export type MeResult = { user: DbUser | null; signupEnabled: boolean };

export async function fetchMe(): Promise<MeResult> {
  const res = await fetch("/api/session", { credentials: "same-origin", cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as { user?: DbUser | null; signupEnabled?: boolean };
  return { user: res.ok ? data.user ?? null : null, signupEnabled: data.signupEnabled === true };
}

export async function loginWithPin(
  name: string,
  pin: string
): Promise<{ user: DbUser | null; error?: string; needsPin?: boolean; locked?: boolean }> {
  const res = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ name: name.trim(), pin }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    user?: DbUser;
    error?: string;
    needsPin?: boolean;
    locked?: boolean;
  };
  if (!res.ok || !data.user) {
    return { user: null, error: data.error || "로그인하지 못했어요.", needsPin: data.needsPin, locked: data.locked };
  }
  return { user: data.user };
}

export async function registerUser(
  name: string,
  organization: string
): Promise<{ ok: boolean; error?: string; message?: string }> {
  const res = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ name: name.trim(), organization: organization.trim(), signup: true }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  return res.ok ? { ok: true, message: data.message } : { ok: false, error: data.error || "등록 실패" };
}

export async function logoutRequest(): Promise<void> {
  await fetch("/api/session", { method: "DELETE", credentials: "same-origin" }).catch(() => undefined);
}
