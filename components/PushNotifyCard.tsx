"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import {
  getExistingSubscription,
  isPushSupported,
  subscribePush,
  subscriptionToJSON,
  unsubscribePush,
} from "@/lib/pushClient";
import { DEFAULT_REMIND_HOUR_KST } from "@/lib/pushRemind";
import { formatHourKst } from "@/lib/date";
import { cn } from "@/lib/utils";

type Status = "loading" | "unsupported" | "off" | "on" | "denied";

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => h);

function hourStorageKey(userId: string) {
  return `wordcatch:remindHour:${userId}`;
}

function loadLocalHour(userId: string | undefined): number {
  if (!userId || typeof window === "undefined") return DEFAULT_REMIND_HOUR_KST;
  try {
    const raw = localStorage.getItem(hourStorageKey(userId));
    if (raw == null) return DEFAULT_REMIND_HOUR_KST;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 23) return DEFAULT_REMIND_HOUR_KST;
    return Math.floor(n);
  } catch {
    return DEFAULT_REMIND_HOUR_KST;
  }
}

function saveLocalHour(userId: string, hour: number) {
  try {
    localStorage.setItem(hourStorageKey(userId), String(hour));
  } catch {
    /* ignore */
  }
}

export function PushNotifyCard() {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [remindHour, setRemindHour] = useState(DEFAULT_REMIND_HOUR_KST);

  const refresh = useCallback(async () => {
    if (!isPushSupported()) {
      setStatus("unsupported");
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    try {
      const sub = await getExistingSubscription();
      setStatus(sub ? "on" : "off");
    } catch {
      setStatus("off");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) {
      setRemindHour(DEFAULT_REMIND_HOUR_KST);
      return;
    }
    setRemindHour(loadLocalHour(user.id));
    void (async () => {
      try {
        const res = await fetch(`/api/push/subscribe?userId=${encodeURIComponent(user.id)}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          remindHourKst?: number;
          hasSubscription?: boolean;
        };
        if (typeof data.remindHourKst === "number") {
          setRemindHour(data.remindHourKst);
          saveLocalHour(user.id, data.remindHourKst);
        }
      } catch {
        /* keep local */
      }
    })();
  }, [user]);

  const onHourChange = async (next: number) => {
    setRemindHour(next);
    if (user) saveLocalHour(user.id, next);
    setMessage(null);

    if (status !== "on" || !user) return;

    setBusy(true);
    try {
      const res = await fetch("/api/push/subscribe", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, remindHourKst: next }),
      });
      const data = (await res.json()) as { error?: string; remindHourKst?: number };
      if (!res.ok) throw new Error(data.error || "시간을 저장하지 못했어요.");
      const hour = data.remindHourKst ?? next;
      setRemindHour(hour);
      saveLocalHour(user.id, hour);
      setMessage(`알림 시간을 ${formatHourKst(hour)}로 바꿨어요.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "시간 저장에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  const enable = async () => {
    if (!user) {
      setMessage("로그인 후 알림을 켤 수 있어요.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const sub = await subscribePush(true);
      const payload = subscriptionToJSON(sub);
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          subscription: payload,
          remindHourKst: remindHour,
        }),
      });
      const data = (await res.json()) as { error?: string; remindHourKst?: number };
      if (!res.ok) {
        try {
          await sub.unsubscribe();
        } catch {
          /* ignore */
        }
        throw new Error(data.error || "서버에 구독을 저장하지 못했어요.");
      }
      const hour = data.remindHourKst ?? remindHour;
      setRemindHour(hour);
      saveLocalHour(user.id, hour);
      setStatus("on");
      setMessage(`매일 ${formatHourKst(hour)}에 복습 알림을 보내 드릴게요.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "알림을 켤 수 없어요.";
      setMessage(msg);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await unsubscribePush();
      setStatus("off");
      setMessage("알림을 껐어요.");
    } catch {
      setMessage("알림 해제에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        알림 상태 확인 중…
      </div>
    );
  }

  if (status === "unsupported") {
    return (
      <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        이 브라우저는 푸시 알림을 지원하지 않아요. (홈 화면 설치·최신 브라우저 권장)
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-100/90">
        알림이 차단되어 있어요. 기기 설정에서 WordCatch 알림을 허용해 주세요.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card px-4 py-3.5">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            status === "on"
              ? "bg-primary/15 text-primary"
              : "bg-muted text-muted-foreground"
          )}
        >
          {status === "on" ? (
            <Bell className="h-5 w-5" />
          ) : (
            <BellOff className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">복습 알림</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {status === "on" ? (
              <>
                매일{" "}
                <span className="font-medium text-primary">
                  {formatHourKst(remindHour)}
                </span>
                <span> · 한국 시간 기준</span>
              </>
            ) : (
              <>시간을 고른 뒤 알림을 켜면, 매일 그 시간에 리마인드를 받아요.</>
            )}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="remind-hour">
              복습 알림 시간
            </label>
            <select
              id="remind-hour"
              value={remindHour}
              disabled={busy}
              onChange={(e) => void onHourChange(Number(e.target.value))}
              className="h-9 rounded-xl border border-border bg-background px-2.5 pr-7 text-xs font-semibold touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {HOUR_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {formatHourKst(h)}
                </option>
              ))}
            </select>

            {status === "off" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void enable()}
                className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground touch-manipulation hover:bg-primary/90 disabled:opacity-50"
              >
                알림 켜기
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void disable()}
                className="rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold touch-manipulation hover:bg-muted disabled:opacity-50"
              >
                알림 끄기
              </button>
            )}
            {status === "on" && (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                켜짐
              </span>
            )}
          </div>

          {message && (
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
