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
  // Vercel(서버리스)에서는 환경변수가 켜져 있어도 절대 정기 발송 안 함 (117 서버와 중복 방지)
  if (process.env.VERCEL) return false;
  const v = (process.env.PUSH_SCHEDULER_ENABLED || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}
