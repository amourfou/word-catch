import { seoulDateKey, seoulHour, startOfTodaySeoulIso } from "@/lib/date";
import { DEFAULT_REMIND_HOUR_KST } from "@/lib/pushRemind";
import { supabase } from "@/lib/supabase";

export { DEFAULT_REMIND_HOUR_KST } from "@/lib/pushRemind";

/** Lazy-load so Edge / instrumentation webpack graphs never bundle native deps. */
function getWebPush(): typeof import("web-push") {
  // Dynamic require — web-push is a serverExternal package (Node http/https).
  return require("web-push");
}

export type PushSubscriptionJSON = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export type PushSubRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_id?: string;
  remind_hour_kst?: number;
  last_notified_on?: string | null;
};

const TABLE = "wordcatch_push_subscriptions";

function trimEnv(v: string | undefined): string {
  if (!v) return "";
  return v.trim().replace(/^["']|["']$/g, "");
}

function clampHour(hour: unknown): number {
  const n = typeof hour === "number" ? hour : Number(hour);
  if (!Number.isFinite(n)) return DEFAULT_REMIND_HOUR_KST;
  return Math.min(23, Math.max(0, Math.floor(n)));
}

function getVapid() {
  const publicKey = trimEnv(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  const privateKey = trimEnv(process.env.VAPID_PRIVATE_KEY);
  const subject = trimEnv(process.env.VAPID_SUBJECT) || "mailto:wordcatch@example.com";
  if (!publicKey || !privateKey) {
    throw new Error(
      "VAPID 키 없음: NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY 를 Vercel에 등록했는지 확인하세요."
    );
  }
  return { publicKey, privateKey, subject };
}

export function configureWebPush() {
  const { publicKey, privateKey, subject } = getVapid();
  getWebPush().setVapidDetails(subject, publicKey, privateKey);
}

export function vapidPublicKeyConfigured(): boolean {
  return !!trimEnv(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
}

/** Save push subscription owned by a user (+ their preferred KST hour). */
export async function savePushSubscription(
  userId: string,
  subscription: PushSubscriptionJSON,
  remindHourKst: number = DEFAULT_REMIND_HOUR_KST
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!userId || !subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return { ok: false, error: "구독 정보가 불완전해요." };
  }

  const hour = clampHour(remindHourKst);
  const row = {
    user_id: userId,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    remind_hour_kst: hour,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from(TABLE).upsert(row, { onConflict: "endpoint" });

  if (error) {
    console.error("savePushSubscription", error);
    const msg = error.message || String(error);
    if (msg.includes("does not exist") || error.code === "42P01") {
      return {
        ok: false,
        error:
          "DB 테이블이 없어요. Supabase에 wordcatch_push_subscriptions 테이블을 만들어 주세요.",
      };
    }
    if (msg.includes("remind_hour_kst") || msg.includes("column")) {
      return {
        ok: false,
        error:
          "DB 컬럼이 없어요. Supabase에서 supabase-migration-push-remind-hour.sql 을 실행해 주세요.",
      };
    }
    return { ok: false, error: `구독 저장 실패: ${msg}` };
  }
  return { ok: true };
}

export async function updateRemindHourForUser(
  userId: string,
  remindHourKst: number
): Promise<{ ok: true; hour: number } | { ok: false; error: string }> {
  if (!userId) return { ok: false, error: "userId required" };
  const hour = clampHour(remindHourKst);
  const { data, error } = await supabase
    .from(TABLE)
    .update({ remind_hour_kst: hour, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .select("endpoint");

  if (error) {
    console.error("updateRemindHourForUser", error);
    return { ok: false, error: error.message };
  }
  if (!data?.length) {
    return { ok: false, error: "저장된 구독이 없어요. 알림을 먼저 켜 주세요." };
  }
  return { ok: true, hour };
}

export async function getRemindHourForUser(
  userId: string
): Promise<{ hour: number | null; hasSubscription: boolean }> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("remind_hour_kst")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return { hour: null, hasSubscription: false };
  }
  return {
    hour: clampHour(data.remind_hour_kst ?? DEFAULT_REMIND_HOUR_KST),
    hasSubscription: true,
  };
}

export async function removePushSubscription(endpoint: string): Promise<boolean> {
  const { error } = await supabase.from(TABLE).delete().eq("endpoint", endpoint);
  if (error) {
    console.error("removePushSubscription", error);
    return false;
  }
  return true;
}

export async function listSubscriptionsForUser(userId: string) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("endpoint, p256dh, auth, remind_hour_kst")
    .eq("user_id", userId);
  if (error) {
    console.error("listSubscriptionsForUser", error);
    return { rows: [] as PushSubRow[], error: error.message };
  }
  return { rows: (data ?? []) as PushSubRow[], error: null as string | null };
}

export async function listAllSubscriptions() {
  const { data, error } = await supabase
    .from(TABLE)
    .select("endpoint, p256dh, auth, user_id, remind_hour_kst, last_notified_on");
  if (error) {
    console.error("listAllSubscriptions", error);
    return [];
  }
  return (data ?? []) as PushSubRow[];
}

export type PushScheduleLine = {
  hour: number;
  deviceCount: number;
  userIds: string[];
  names: string[];
};

/** Snapshot of registered remind hours (for personal-server startup logs). */
export async function getPushScheduleSummary(): Promise<{
  lines: PushScheduleLine[];
  totalDevices: number;
  error?: string;
}> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("user_id, remind_hour_kst, endpoint");

  if (error) {
    console.error("getPushScheduleSummary", error);
    return { lines: [], totalDevices: 0, error: error.message };
  }

  const rows = data ?? [];
  const byHour = new Map<number, { endpoints: Set<string>; userIds: Set<string> }>();

  for (const r of rows) {
    const hour = clampHour(r.remind_hour_kst ?? DEFAULT_REMIND_HOUR_KST);
    const bucket = byHour.get(hour) ?? {
      endpoints: new Set<string>(),
      userIds: new Set<string>(),
    };
    if (r.endpoint) bucket.endpoints.add(r.endpoint as string);
    if (r.user_id) bucket.userIds.add(r.user_id as string);
    byHour.set(hour, bucket);
  }

  const allUserIds = Array.from(
    new Set(rows.map((r) => r.user_id as string | null).filter((id): id is string => !!id))
  );
  const nameMap = new Map<string, string>();
  if (allUserIds.length > 0) {
    const { data: users, error: userErr } = await supabase
      .from("users")
      .select("id, name")
      .in("id", allUserIds);
    if (userErr) {
      console.error("getPushScheduleSummary users", userErr);
    } else {
      for (const u of users ?? []) {
        nameMap.set(u.id as string, (u.name as string) || "사용자");
      }
    }
  }

  const lines: PushScheduleLine[] = Array.from(byHour.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hour, bucket]) => {
      const userIds = Array.from(bucket.userIds);
      return {
        hour,
        deviceCount: bucket.endpoints.size,
        userIds,
        names: userIds.map((id) => nameMap.get(id) || id.slice(0, 8)),
      };
    });

  return { lines, totalDevices: rows.length };
}

/** Subs due for this KST hour and not yet notified today. */
export async function listDueSubscriptions(hourKst?: number) {
  const hour = hourKst ?? seoulHour();
  const today = seoulDateKey();
  const { data, error } = await supabase
    .from(TABLE)
    .select("endpoint, p256dh, auth, user_id, remind_hour_kst, last_notified_on")
    .eq("remind_hour_kst", hour);

  if (error) {
    console.error("listDueSubscriptions", error);
    return { rows: [] as PushSubRow[], hour, today, error: error.message };
  }

  const rows = ((data ?? []) as PushSubRow[]).filter(
    (r) => !r.last_notified_on || r.last_notified_on < today
  );
  return { rows, hour, today, error: null as string | null };
}

async function markNotified(endpoints: string[], dateKey: string) {
  if (endpoints.length === 0) return;
  const { error } = await supabase
    .from(TABLE)
    .update({ last_notified_on: dateKey, updated_at: new Date().toISOString() })
    .in("endpoint", endpoints);
  if (error) console.error("markNotified", error);
}

/** Users who already have at least one review log since KST midnight. */
export async function userIdsWhoReviewedToday(
  userIds: string[]
): Promise<Set<string>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return new Set();

  const since = startOfTodaySeoulIso();
  const { data, error } = await supabase
    .from("wordcatch_review_logs")
    .select("user_id")
    .in("user_id", unique)
    .gte("reviewed_at", since);

  if (error) {
    console.error("userIdsWhoReviewedToday", error);
    return new Set();
  }

  return new Set((data ?? []).map((r) => r.user_id as string));
}

export async function sendPushToSubscription(
  sub: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
): Promise<{ status: "ok" | "gone" | "error"; detail?: string }> {
  try {
    configureWebPush();
  } catch (e) {
    return {
      status: "error",
      detail: e instanceof Error ? e.message : "VAPID 설정 오류",
    };
  }

  try {
    await getWebPush().sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 }
    );
    return { status: "ok" };
  } catch (e: unknown) {
    const err = e as { statusCode?: number; body?: string; message?: string };
    const status = err?.statusCode;
    const detail = [status && `HTTP ${status}`, err?.body || err?.message]
      .filter(Boolean)
      .join(" ");
    console.error("sendPush", detail, e);

    if (status === 404 || status === 410) {
      await removePushSubscription(sub.endpoint);
      return { status: "gone", detail };
    }
    return { status: "error", detail: detail || "push failed" };
  }
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  extraSub?: PushSubscriptionJSON | null,
  remindHourKst?: number
): Promise<{
  sent: number;
  failed: number;
  total: number;
  details: string[];
  dbError?: string;
}> {
  const { rows, error: dbError } = await listSubscriptionsForUser(userId);
  const map = new Map<string, PushSubRow>();
  for (const r of rows) map.set(r.endpoint, r);

  if (extraSub?.endpoint && extraSub.keys?.p256dh && extraSub.keys?.auth) {
    map.set(extraSub.endpoint, {
      endpoint: extraSub.endpoint,
      p256dh: extraSub.keys.p256dh,
      auth: extraSub.keys.auth,
    });
    await savePushSubscription(
      userId,
      extraSub,
      remindHourKst ?? DEFAULT_REMIND_HOUR_KST
    );
  }

  const list = Array.from(map.values());
  let sent = 0;
  let failed = 0;
  const details: string[] = [];

  if (list.length === 0) {
    details.push(
      dbError
        ? `DB 조회 실패: ${dbError}`
        : "이 계정으로 저장된 푸시 구독이 없어요. 알림을 끈 뒤 다시 켜 주세요."
    );
    return { sent: 0, failed: 0, total: 0, details, dbError: dbError ?? undefined };
  }

  for (const sub of list) {
    const r = await sendPushToSubscription(sub, payload);
    if (r.status === "ok") sent += 1;
    else {
      failed += 1;
      details.push(r.detail || r.status);
    }
  }
  return { sent, failed, total: list.length, details, dbError: dbError ?? undefined };
}

export async function sendPushToAll(
  payload: PushPayload
): Promise<{ sent: number; failed: number; total: number }> {
  const subs = await listAllSubscriptions();
  let sent = 0;
  let failed = 0;
  for (const sub of subs) {
    const r = await sendPushToSubscription(sub, payload);
    if (r.status === "ok") sent += 1;
    else failed += 1;
  }
  return { sent, failed, total: subs.length };
}

/**
 * Scheduler tick (personal server, hourly):
 * - only rows with remind_hour_kst === current KST hour
 * - skip users who already reviewed today
 * - once per day per subscription (last_notified_on)
 */
export async function sendDueReminders(payload?: Partial<PushPayload>): Promise<{
  sent: number;
  failed: number;
  skippedReviewed: number;
  total: number;
  hour: number;
  today: string;
  error?: string;
}> {
  const { rows, hour, today, error } = await listDueSubscriptions();
  if (error) {
    return {
      sent: 0,
      failed: 0,
      skippedReviewed: 0,
      total: 0,
      hour,
      today,
      error,
    };
  }

  const reviewed = await userIdsWhoReviewedToday(
    rows.map((r) => r.user_id).filter((id): id is string => !!id)
  );

  const due = rows.filter((r) => !r.user_id || !reviewed.has(r.user_id));
  const skippedReviewed = rows.length - due.length;

  const skipEndpoints = rows
    .filter((r) => r.user_id && reviewed.has(r.user_id))
    .map((r) => r.endpoint);
  await markNotified(skipEndpoints, today);

  const full: PushPayload = {
    title: payload?.title || "WordCatch",
    body: payload?.body || "아직 오늘 복습이 없어요. 잠깐만 해볼까요?",
    url: payload?.url || "/review",
    tag: payload?.tag || "wordcatch-daily",
  };

  let sent = 0;
  let failed = 0;
  const okEndpoints: string[] = [];

  for (const sub of due) {
    const r = await sendPushToSubscription(sub, full);
    if (r.status === "ok") {
      sent += 1;
      okEndpoints.push(sub.endpoint);
    } else {
      failed += 1;
    }
  }

  await markNotified(okEndpoints, today);
  return {
    sent,
    failed,
    skippedReviewed,
    total: rows.length,
    hour,
    today,
  };
}
