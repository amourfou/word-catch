/**
 * Runs when the Next.js server boots.
 * Personal server: PUSH_SCHEDULER_ENABLED=true → in-process push timer.
 * Vercel / Edge: no-op (never load web-push).
 */
export async function register() {
  // Edge instrumentation bundle must not import Node-only modules
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }

  const flag = (process.env.PUSH_SCHEDULER_ENABLED || "").trim().toLowerCase();
  const enabled =
    flag === "1" || flag === "true" || flag === "yes" || flag === "on";

  if (!enabled) {
    // Only log on Node server boot (skip silent edge passes)
    if (process.env.NEXT_RUNTIME === "nodejs" || !process.env.NEXT_RUNTIME) {
      console.log(
        "[push-scheduler] disabled (PUSH_SCHEDULER_ENABLED is not true)"
      );
    }
    return;
  }

  // Node-only path — dynamic import kept behind runtime check
  if (process.env.NEXT_RUNTIME === "nodejs" || !process.env.NEXT_RUNTIME) {
    const { startPushScheduler } = await import("./lib/pushScheduler");
    startPushScheduler();
  }
}
