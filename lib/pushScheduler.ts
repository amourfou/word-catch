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

async function logScheduleSnapshot(
  label: string,
  options?: { hourOnly?: number }
): Promise<void> {
  const { getPushScheduleSummary, PUSH_APP } = await pushLib();
  const { lines, totalDevices, error, app } = await getPushScheduleSummary(options);
  if (error) {
    console.warn(`[push-scheduler] ${label} DB error:`, error);
    return;
  }
  if (lines.length === 0) {
    console.log(
      `[push-scheduler] ${label} app=${app || PUSH_APP} devices=0` +
        (options?.hourOnly !== undefined
          ? ` hour=${formatHourKst(options.hourOnly)}`
          : "") +
        " (no matching rows)"
    );
    return;
  }

  console.log(
    `[push-scheduler] ${label} app=${app || PUSH_APP} devices=${totalDevices}`
  );
  for (const line of lines) {
    const who =
      line.names.length > 0 ? line.names.join(", ") : "(no user_id)";
    console.log(
      `[push-scheduler]   · ${formatHourKst(line.hour).padEnd(8)}  devices=${line.deviceCount}  users=${who}`
    );
  }
}

async function tick(): Promise<void> {
  if (!isPushSchedulerEnabled()) return;

  const minute = seoulMinute();
  if (minute > RUN_UNTIL_MINUTE) return;

  const hour = seoulHour();
  const key = `${seoulDateKey()}-${hour}`;
  if (g().__wordcatchPushSchedulerLastKey === key) return;
  g().__wordcatchPushSchedulerLastKey = key;

  try {
    console.log(
      `[push-scheduler] === fire window ${key} (${formatHourKst(hour)} KST, min ${minute}) — WordCatch only ===`
    );
    await logScheduleSnapshot("pre-send DB", { hourOnly: hour });

    const { sendDueReminders } = await pushLib();
    const result = await sendDueReminders({
      title: "WordCatch",
      body: "아직 오늘 복습이 없어요. 잠깐만 해볼까요?",
      url: "/review",
      tag: "wordcatch-daily",
    });
    console.log("[push-scheduler] send result", {
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
 * WordCatch only — other apps run their own backends.
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
    "[push-scheduler] started — WordCatch only, checks every 60s, fires once per KST hour (min 0–5)"
  );

  void logScheduleSnapshot("startup all schedules");

  void tick();
  g().__wordcatchPushSchedulerTimer = setInterval(() => {
    void tick();
  }, TICK_MS);

  g().__wordcatchPushSchedulerTimer?.unref?.();
}
