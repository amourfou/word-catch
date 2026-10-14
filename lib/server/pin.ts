import "server-only";
/**
 * Shared PIN credentials (public.user_pins + public.auth_attempts), same file in
 * WordCatch and genshin-guide. Hash format matches genshin: scrypt$N$salt$hash.
 */
import crypto from "crypto";
import { promisify } from "util";
import { isMissingTable, supabase } from "@/lib/server/db";
import { ApiError } from "@/lib/server/http";

const scrypt = promisify(crypto.scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: crypto.ScryptOptions
) => Promise<Buffer>;
const PARAMS = { N: 16384, r: 8, p: 1 };

export const MAX_FAILURES = 5;
export const LOCK_MS = 10 * 60 * 1000;
export const IP_WINDOW_MS = 10 * 60 * 1000;
export const IP_MAX_FAILURES = 20;
export const PIN_LENGTH = 6;
export const PIN_PATTERN = /^\d{6}$/;

export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(pin, salt, 32, PARAMS);
  return `scrypt$${PARAMS.N}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function checkPin(pin: string, stored: string): Promise<boolean> {
  const [kind, n, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scrypt(pin, Buffer.from(salt, "base64url"), expected.length, { ...PARAMS, N: Number(n) });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function pinFingerprint(hash: string): string {
  return crypto.createHash("sha256").update(hash).digest("base64url").slice(0, 16);
}

export interface PinRow {
  user_id: string;
  pin_hash: string;
  failed_count: number | null;
  locked_until: string | null;
}

/** Reads the shared PIN row. Throws 503 if the table is not migrated yet. */
export async function readPin(userId: string): Promise<PinRow | null> {
  const { data, error } = await supabase
    .from("user_pins")
    .select("user_id, pin_hash, failed_count, locked_until")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) throw new ApiError(503, "PIN 저장소가 아직 준비되지 않았어요. 관리자에게 알려 주세요.");
    throw error;
  }
  return (data as PinRow) ?? null;
}

export async function setPin(userId: string, pin: string): Promise<string> {
  if (!PIN_PATTERN.test(pin)) throw new ApiError(400, "PIN은 숫자 6자리예요.");
  const pin_hash = await hashPin(pin);
  const { error } = await supabase.from("user_pins").upsert(
    { user_id: userId, pin_hash, failed_count: 0, locked_until: null, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (error) {
    if (isMissingTable(error)) throw new ApiError(503, "PIN 저장소(user_pins)가 아직 없어요.");
    throw error;
  }
  return pin_hash;
}

export async function clearPinLock(userId: string): Promise<void> {
  await supabase.from("user_pins").update({ failed_count: 0, locked_until: null }).eq("user_id", userId);
}

/** IP-level throttle backed by auth_attempts. Missing table = no IP throttle (logged). */
export async function assertIpAllowed(ip: string, app: string): Promise<void> {
  const since = new Date(Date.now() - IP_WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from("auth_attempts")
    .select("id", { count: "exact", head: true })
    .eq("key", `ip:${ip}`)
    .eq("app", app)
    .eq("ok", false)
    .gte("created_at", since);
  if (error) {
    console.warn("[auth] ip throttle unavailable", error.message);
    return;
  }
  if ((count ?? 0) >= IP_MAX_FAILURES) {
    throw new ApiError(429, "너무 많이 시도했어요. 10분 뒤에 다시 해 주세요.");
  }
}

export async function recordAttempt(ip: string, app: string, ok: boolean): Promise<void> {
  const { error } = await supabase.from("auth_attempts").insert({ key: `ip:${ip}`, app, ok });
  if (error) console.warn("[auth] attempt log failed", error.message);
}

/** Verifies a PIN against a row, updating lockout counters. Returns true on success. */
export async function verifyPinRow(
  row: PinRow,
  pin: string,
  table: "user_pins" | "genshin_logins" = "user_pins"
): Promise<boolean> {
  if (row.locked_until && Date.parse(row.locked_until) > Date.now()) {
    throw new ApiError(429, "PIN을 여러 번 틀려서 10분 동안 잠겼어요. 잠시 쉬었다가 해 볼까요?", { locked: true });
  }
  const ok = await checkPin(pin, row.pin_hash);
  if (!ok) {
    const failures = (row.failed_count ?? 0) + 1;
    const locked = failures >= MAX_FAILURES;
    await supabase
      .from(table)
      .update({
        failed_count: locked ? 0 : failures,
        locked_until: locked ? new Date(Date.now() + LOCK_MS).toISOString() : null,
      })
      .eq("user_id", row.user_id);
    return false;
  }
  if (row.failed_count || row.locked_until) {
    await supabase.from(table).update({ failed_count: 0, locked_until: null }).eq("user_id", row.user_id);
  }
  return true;
}
