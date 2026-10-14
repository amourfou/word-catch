import { NextResponse } from "next/server";
import { supabase } from "@/lib/server/db";
import { ApiError, assertSameOrigin, clientIp, fail, readJson } from "@/lib/server/http";
import { assertIpAllowed, readPin, recordAttempt, verifyPinRow } from "@/lib/server/pin";
import { clearSessionCookie, currentUser, publicSignupEnabled, setSessionCookie } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP = "wordcatch";
const WRONG = "이름이나 PIN이 맞지 않아요.";

/** Who am I (from signed cookie). */
export async function GET() {
  try {
    const user = await currentUser();
    return NextResponse.json({ user, signupEnabled: publicSignupEnabled() }, { status: user ? 200 : 401 });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request) {
  try {
    assertSameOrigin(req);
  } catch (e) {
    return fail(e);
  }
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}

/** Login: { name, pin }. Sign-up: { name, organization, signup: true } only if ALLOW_PUBLIC_SIGNUP. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const body = await readJson<{ name?: unknown; pin?: unknown; organization?: unknown; signup?: unknown }>(req);
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) throw new ApiError(400, "이름을 입력해 주세요.");

    if (body.signup === true) {
      if (!publicSignupEnabled()) {
        throw new ApiError(403, "지금은 직접 가입할 수 없어요. 관리자(부모님)에게 계정을 만들어 달라고 해 주세요.");
      }
      const organization = typeof body.organization === "string" ? body.organization.trim() : "";
      if (!organization) throw new ApiError(400, "소속을 입력해 주세요.");
      if (name.length > 10) throw new ApiError(400, "이름은 10자까지예요.");
      if (organization.length > 15) throw new ApiError(400, "소속은 15자까지예요.");
      const { data: exists } = await supabase.from("users").select("id").eq("name", name).maybeSingle();
      if (exists) throw new ApiError(409, "이미 사용 중인 이름이에요.");
      const { error } = await supabase.from("users").insert([{ name, organization, high_score: 0 }]);
      if (error) throw error;
      return NextResponse.json({ ok: true, created: true, needsPin: true, message: "가입했어요. 관리자에게 PIN을 받아 주세요." });
    }

    const pin = typeof body.pin === "string" ? body.pin : "";
    if (!/^\d{6}$/.test(pin)) throw new ApiError(400, "PIN 6자리를 눌러 주세요.");
    const ip = clientIp(req);
    await assertIpAllowed(ip, APP);

    const { data: user, error } = await supabase.from("users").select("id").eq("name", name).maybeSingle();
    if (error) throw error;
    if (!user) {
      await recordAttempt(ip, APP, false);
      throw new ApiError(401, WRONG);
    }
    const row = await readPin(String(user.id));
    if (!row) {
      throw new ApiError(403, "아직 PIN이 없어요. 관리자(부모님)에게 PIN을 만들어 달라고 해 주세요.", { needsPin: true });
    }
    const ok = await verifyPinRow(row, pin);
    await recordAttempt(ip, APP, ok);
    if (!ok) throw new ApiError(401, WRONG);

    // last-seen, same as before (admin list uses updated_at)
    await supabase.from("users").update({ updated_at: new Date().toISOString() }).eq("id", user.id);
    const { data: full } = await supabase
      .from("users")
      .select("id, name, organization, role, is_admin, high_score, created_at, updated_at")
      .eq("id", user.id)
      .maybeSingle();
    const res = NextResponse.json({ user: full });
    setSessionCookie(res, String(user.id), row.pin_hash);
    return res;
  } catch (e) {
    return fail(e);
  }
}
