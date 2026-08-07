/** Browser-side Web Push subscribe helpers (free VAPID). */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function waitForServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("이 브라우저는 Service Worker 를 지원하지 않아요.");
  }

  const ready = await navigator.serviceWorker.ready;
  if (ready) return ready;

  const reg = await navigator.serviceWorker.getRegistration();
  if (reg) return reg;

  throw new Error(
    "Service Worker 가 아직 없어요. 앱을 홈 화면에 설치했는지, 배포(프로덕션) 환경인지 확인해 주세요."
  );
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await waitForServiceWorker();
    return reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/**
 * Subscribe with current VAPID public key.
 * If an old subscription exists (different key), unsubscribe first.
 */
export async function subscribePush(forceNew = true): Promise<PushSubscription> {
  if (!isPushSupported()) {
    throw new Error("이 기기는 푸시 알림을 지원하지 않아요.");
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (!publicKey) {
    throw new Error(
      "NEXT_PUBLIC_VAPID_PUBLIC_KEY 가 빌드에 없어요. Vercel에 넣고 재배포했는지 확인하세요."
    );
  }

  if (!window.isSecureContext) {
    throw new Error("HTTPS(보안 연결)에서만 알림을 쓸 수 있어요.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("알림 권한이 거부되었어요. 설정에서 허용해 주세요.");
  }

  const reg = await waitForServiceWorker();
  const existing = await reg.pushManager.getSubscription();

  if (existing && forceNew) {
    try {
      await existing.unsubscribe();
    } catch {
      /* ignore */
    }
  } else if (existing && !forceNew) {
    return existing;
  }

  try {
    return await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`구독 실패: ${msg}`);
  }
}

export async function unsubscribePush(): Promise<boolean> {
  const sub = await getExistingSubscription();
  if (!sub) return true;
  const endpoint = sub.endpoint;
  const ok = await sub.unsubscribe();
  try {
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    });
  } catch {
    /* ignore */
  }
  return ok;
}

export function subscriptionToJSON(sub: PushSubscription) {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("구독 키를 읽을 수 없어요.");
  }
  return {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
  };
}
