/**
 * Which process runs scheduled push reminders (in-process timer).
 *
 * - Vercel (app UI + subscribe): leave unset / false
 * - Personal server (long-running `next start`): PUSH_SCHEDULER_ENABLED=true
 *
 * Subscribe (/api/push/subscribe) always works on any host with DB + VAPID.
 * Manual /api/push/send still works for tests when authorized.
 */
export function isPushSchedulerEnabled(): boolean {
  const v = (process.env.PUSH_SCHEDULER_ENABLED || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}
