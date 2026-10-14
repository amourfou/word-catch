/** Client helpers for admin API calls. */

export async function adminFetch<T>(
  path: string,
  adminUserId: string,
  init?: RequestInit & { json?: unknown }
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  // adminUserId is kept for call-site compatibility only; the server trusts the session cookie.
  void adminUserId;
  const headers = new Headers(init?.headers);
  let body = init?.body;
  if (init?.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }
  const res = await fetch(path, { ...init, headers, body, credentials: "same-origin" });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    return {
      ok: false,
      error: data.error || `HTTP ${res.status}`,
      status: res.status,
    };
  }
  return { ok: true, data };
}
