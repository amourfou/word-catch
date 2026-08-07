import webpush from "web-push";
import { supabase } from "@/lib/supabase";

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

const TABLE = "wordcatch_push_subscriptions";

function trimEnv(v: string | undefined): string {
  if (!v) return "";
  // Vercel/env paste often includes quotes or newlines
  return v.trim().replace(/^["']|["']$/g, "");
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
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export function vapidPublicKeyConfigured(): boolean {
  return !!trimEnv(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
}

export async function savePushSubscription(
  userId: string,
  subscription: PushSubscriptionJSON
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!userId || !subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return { ok: false, error: "구독 정보가 불완전해요." };
  }

  const row = {
    user_id: userId,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
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
    return { ok: false, error: `구독 저장 실패: ${msg}` };
  }
  return { ok: true };
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
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error) {
    console.error("listSubscriptionsForUser", error);
    return { rows: [] as { endpoint: string; p256dh: string; auth: string }[], error: error.message };
  }
  return { rows: data ?? [], error: null as string | null };
}

export async function listAllSubscriptions() {
  const { data, error } = await supabase
    .from(TABLE)
    .select("endpoint, p256dh, auth, user_id");
  if (error) {
    console.error("listAllSubscriptions", error);
    return [];
  }
  return data ?? [];
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
    await webpush.sendNotification(
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
  extraSub?: PushSubscriptionJSON | null
): Promise<{
  sent: number;
  failed: number;
  total: number;
  details: string[];
  dbError?: string;
}> {
  const { rows, error: dbError } = await listSubscriptionsForUser(userId);
  const map = new Map<string, { endpoint: string; p256dh: string; auth: string }>();
  for (const r of rows) map.set(r.endpoint, r);

  if (extraSub?.endpoint && extraSub.keys?.p256dh && extraSub.keys?.auth) {
    map.set(extraSub.endpoint, {
      endpoint: extraSub.endpoint,
      p256dh: extraSub.keys.p256dh,
      auth: extraSub.keys.auth,
    });
    await savePushSubscription(userId, extraSub);
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
