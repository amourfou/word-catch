import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { supabase } from "@/lib/server/db";
import { ApiError } from "@/lib/server/http";
import { pinFingerprint, readPin } from "@/lib/server/pin";
import { canAccessAdmin, getUserRole, type UserRole } from "@/lib/roles";
import type { DbUser } from "@/lib/supabase";

const COOKIE = "wordcatch_session";
const MAX_AGE_S = 60 * 60 * 24 * 30;

interface Token {
  u: string;
  p: string;
  iat: number;
}

function key(): Buffer {
  const raw = process.env.SESSION_SECRET || "";
  if (raw.length < 16) throw new ApiError(503, "서버에 세션 키(SESSION_SECRET)가 없어 로그인할 수 없어요.");
  return crypto.createHash("sha256").update(`wordcatch-session:${raw}`).digest();
}

function mac(body: string): string {
  return crypto.createHmac("sha256", key()).update(body).digest("base64url");
}

function sign(token: Token): string {
  const body = Buffer.from(JSON.stringify(token)).toString("base64url");
  return `${body}.${mac(body)}`;
}

function verify(raw: string | undefined): Token | null {
  if (!raw) return null;
  const [body, sig] = raw.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(mac(body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const t = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Token;
    if (!t.u || !t.p || !Number.isFinite(t.iat)) return null;
    if (Date.now() / 1000 - t.iat > MAX_AGE_S) return null;
    return t;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: NextResponse, userId: string, pinHash: string): void {
  res.cookies.set(COOKIE, sign({ u: userId, p: pinFingerprint(pinHash), iat: Math.floor(Date.now() / 1000) }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export type PublicUser = Pick<DbUser, "id" | "name" | "organization" | "role" | "is_admin" | "high_score" | "created_at" | "updated_at">;

/** Signed cookie + PIN still current + user row (role read fresh from DB every request). */
export async function currentUser(): Promise<PublicUser | null> {
  const t = verify(cookies().get(COOKIE)?.value);
  if (!t) return null;
  const pin = await readPin(t.u);
  if (!pin || pinFingerprint(pin.pin_hash) !== t.p) return null;
  const { data, error } = await supabase
    .from("users")
    .select("id, name, organization, role, is_admin, high_score, created_at, updated_at")
    .eq("id", t.u)
    .maybeSingle();
  if (error) throw error;
  return (data as PublicUser) ?? null;
}

export async function requireUser(): Promise<PublicUser> {
  const u = await currentUser();
  if (!u) throw new ApiError(401, "다시 로그인해 주세요.");
  return u;
}

export async function requireAdmin(): Promise<{ admin: PublicUser; role: UserRole }> {
  const u = await requireUser();
  if (!canAccessAdmin(u)) throw new ApiError(403, "관리자만 사용할 수 있어요.");
  return { admin: u, role: getUserRole(u) };
}

export function publicSignupEnabled(): boolean {
  return ["1", "true", "yes", "on"].includes((process.env.ALLOW_PUBLIC_SIGNUP || "").trim().toLowerCase());
}
