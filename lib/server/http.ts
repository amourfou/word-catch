import "server-only";
import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export function fail(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message, ...(error.extra ?? {}) }, { status: error.status });
  }
  console.error("[api]", error);
  const msg = error instanceof Error && /SUPABASE_SERVICE_ROLE_KEY|SESSION_SECRET/.test(error.message)
    ? "서버 설정이 아직 끝나지 않았어요."
    : "서버 오류가 났어요. 잠시 후 다시 해 주세요.";
  return NextResponse.json({ error: msg }, { status: 500 });
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  return fwd.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/** Reject cross-site state-changing requests (defense in depth on top of SameSite=Lax). */
export function assertSameOrigin(req: Request): void {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new ApiError(403, "다른 사이트에서 온 요청은 받을 수 없어요.");
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(403, "잘못된 요청이에요.");
  }
}
