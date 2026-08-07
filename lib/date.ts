/** Date boundaries in Korea Standard Time (KST, UTC+9). No DST. */

const SEOUL = "Asia/Seoul";

function seoulParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value])
  );
  return {
    year: parts.year!,
    month: parts.month!,
    day: parts.day!,
    weekday: parts.weekday!, // Mon, Tue, ...
  };
}

/** YYYY-MM-DD in KST */
export function seoulDateKey(date = new Date()): string {
  const { year, month, day } = seoulParts(date);
  return `${year}-${month}-${day}`;
}

/** Hour 0–23 in KST */
export function seoulHour(date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SEOUL,
    hour: "numeric",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date);
  const raw = parts.find((p) => p.type === "hour")?.value ?? "0";
  const n = Number.parseInt(raw, 10);
  // Some engines emit 24 for midnight
  if (!Number.isFinite(n) || n === 24) return 0;
  return Math.min(23, Math.max(0, n));
}

/** e.g. 19 → "오후 7시" */
export function formatHourKst(hour: number): string {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h === 0) return "자정 0시";
  if (h === 12) return "정오 12시";
  if (h < 12) return `오전 ${h}시`;
  return `오후 ${h - 12}시`;
}

/** Parse KST wall-clock into a UTC Instant (ISO string for timestamptz compare). */
function kstWallToUtcIso(
  year: string | number,
  month: string | number,
  day: string | number,
  hour = 0,
  minute = 0,
  second = 0
): string {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  const ss = String(second).padStart(2, "0");
  // Explicit +09:00 — not browser local, not bare UTC midnight
  return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}+09:00`).toISOString();
}

/** Start of today in KST (00:00:00+09:00), as UTC ISO for DB compare. */
export function startOfTodaySeoulIso(): string {
  const { year, month, day } = seoulParts();
  return kstWallToUtcIso(year, month, day, 0, 0, 0);
}

/** Start of this week (Monday 00:00 KST). */
export function startOfWeekSeoulIso(): string {
  const { year, month, day, weekday } = seoulParts();
  const weekdayIndex: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const offset = weekdayIndex[weekday] ?? 0;
  // Shift from KST noon to avoid day-boundary ambiguity
  const noonMs = new Date(kstWallToUtcIso(year, month, day, 12, 0, 0)).getTime();
  const mondayNoon = new Date(noonMs - offset * 24 * 60 * 60 * 1000);
  const p = seoulParts(mondayNoon);
  return kstWallToUtcIso(p.year, p.month, p.day, 0, 0, 0);
}

/** Start of this month (1st 00:00 KST). */
export function startOfMonthSeoulIso(): string {
  const { year, month } = seoulParts();
  return kstWallToUtcIso(year, month, 1, 0, 0, 0);
}

export function formatDateKo(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: SEOUL,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}
