import { formatHourKst, seoulDateKey, seoulHour, seoulMinute } from "@/lib/date";
import { isPushSchedulerEnabled } from "@/lib/pushConfig";

const TICK_MS = 60_000;
/** Run once in the first few minutes of each KST hour (covers short downtime). */
const RUN_UNTIL_MINUTE = 5;

type GlobalScheduler = typeof globalThis & {
  __wordcatchPushSchedulerStarted?: boolean;
  __wordcatchPushSchedulerLastKey?: string;
  __wordcatchPushSchedulerTimer?: ReturnType<typeof setInterval>;
};

function g(): GlobalScheduler {
  return globalThis as GlobalScheduler;
}

/** Dynamic import — avoids static link of web-push into instrumentation graph. */
async function pushLib() {
  return import("@/lib/push");
}

async function logRegisteredSchedules(): Promise<void> {
  const { getPushScheduleSummary } = await pushLib();
  const { lines, totalDevices, error } = await getPushScheduleSummary();
  if (error) {
    console.warn("[push-scheduler] could not load schedules:", error);
    return;
  }
  if (lines.length === 0) {
    console.log(
      "[push-scheduler] registered schedules: (none — no push subscriptions yet)"
    );
    return;
  }

  console.log(
    `[push-scheduler] registered schedules: ${lines.length} hour slot(s), ${totalDevices} device(s)`
  );
  for (const line of lines) {
    const who =
      line.names.length > 0 ? line.names.join(", ") : "(no user_id)";
    console.log(
      `[push-scheduler]   · ${formatHourKst(line.hour).padEnd(8)}  devices=${line.deviceCount}  users=${who}`
    );
  }
  console.log(
    `[push-scheduler] next fire window: each KST hour at min 0–${RUN_UNTIL_MINUTE} (now ${formatHourKst(seoulHour())} KST)`
  );
}

async function tick(): Promise<void> {
  if (!isPushSchedulerEnabled()) return;

  const minute = seoulMinute();
  if (minute > RUN_UNTIL_MINUTE) return;

  const key = `${seoulDateKey()}-${seoulHour()}`;
  if (g().__wordcatchPushSchedulerLastKey === key) return;
  g().__wordcatchPushSchedulerLastKey = key;

  try {
    const { sendDueReminders } = await pushLib();
    const result = await sendDueReminders({
      title: "WordCatch",
      body: "아직 오늘 복습이 없어요. 잠깐만 해볼까요?",
      url: "/review",
      tag: "wordcatch-daily",
    });
    console.log("[push-scheduler]", {
      key,
      sent: result.sent,
      failed: result.failed,
      skippedReviewed: result.skippedReviewed,
      total: result.total,
      error: result.error,
    });
  } catch (e) {
    console.error("[push-scheduler] tick failed", e);
  }
}

/**
 * In-process hourly reminder loop for long-running Node (personal server).
 * No-op when PUSH_SCHEDULER_ENABLED is not true (e.g. Vercel).
 * Safe to call multiple times — starts at most once per process.
 */
export function startPushScheduler(): void {
  if (!isPushSchedulerEnabled()) {
    console.log(
      "[push-scheduler] disabled (PUSH_SCHEDULER_ENABLED is not true)"
    );
    return;
  }
  if (g().__wordcatchPushSchedulerStarted) return;
  g().__wordcatchPushSchedulerStarted = true;

  console.log(
    "[push-scheduler] started — checks every 60s, fires once per KST hour (min 0–5)"
  );

  void logRegisteredSchedules();

  void tick();
  g().__wordcatchPushSchedulerTimer = setInterval(() => {
    void tick();
  }, TICK_MS);

  g().__wordcatchPushSchedulerTimer?.unref?.();
}
