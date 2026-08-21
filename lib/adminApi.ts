/** Client helpers for admin API calls. */

export async function adminFetch<T>(
  path: string,
  adminUserId: string,
  init?: RequestInit & { json?: unknown }
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const headers = new Headers(init?.headers);
  headers.set("x-admin-user-id", adminUserId);
  let body = init?.body;
  if (init?.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify({ adminUserId, ...(init.json as object) });
  }
  const res = await fetch(path, { ...init, headers, body });
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
