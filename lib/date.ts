/** Asia/Seoul helpers for "today" / "this week" filters. */

const SEOUL = "Asia/Seoul";

function seoulParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
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

/** Start of Seoul calendar day as UTC ISO string. */
export function startOfTodaySeoulIso(): string {
  const { year, month, day } = seoulParts();
  // Seoul is UTC+9 with no DST
  const utcMs = Date.UTC(Number(year), Number(month) - 1, Number(day), 0, 0, 0) - 9 * 60 * 60 * 1000;
  return new Date(utcMs).toISOString();
}

/** Start of this week (Monday 00:00 Seoul) as UTC ISO string. */
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
  const utcMs =
    Date.UTC(Number(year), Number(month) - 1, Number(day), 0, 0, 0) -
    9 * 60 * 60 * 1000 -
    offset * 24 * 60 * 60 * 1000;
  return new Date(utcMs).toISOString();
}

export function formatDateKo(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: SEOUL,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}
