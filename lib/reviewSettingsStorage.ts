import type { ReviewSettings, ReviewTarget } from "@/lib/reviewEngine";
import { defaultReviewSettings } from "@/lib/reviewEngine";
import type { ReviewMode, TestType } from "@/lib/supabase";

const STORAGE_KEY = "wordcatch-review-targets";

const VALID_TARGETS = new Set<ReviewTarget>([
  "today",
  "week",
  "month",
  "unknown",
  "learning",
  "mastered",
  "all",
]);

const VALID_MODES = new Set<ReviewMode>(["test", "flashcard"]);
const VALID_DIRECTIONS = new Set<ReviewSettings["direction"]>([
  "mixed",
  "en_to_ko",
  "ko_to_en",
  "listen_to_ko",
]);
const VALID_TEST_FORMATS = new Set<TestType>([
  "multiple_choice",
  "direct_input",
]);

export type StoredReviewPrefs = Pick<
  ReviewSettings,
  "mode" | "direction" | "testFormat" | "targets" | "sources" | "count"
>;

function defaults(): StoredReviewPrefs {
  const d = defaultReviewSettings();
  return {
    mode: d.mode,
    direction: d.direction,
    testFormat: d.testFormat,
    targets: d.targets,
    sources: d.sources,
    count: d.count,
  };
}

export function loadReviewPrefs(userId: string): StoredReviewPrefs {
  if (typeof window === "undefined") return defaults();
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${userId}`);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw) as Partial<StoredReviewPrefs>;
    const base = defaults();

    const targets = Array.isArray(parsed.targets)
      ? parsed.targets.filter((t): t is ReviewTarget =>
          VALID_TARGETS.has(t as ReviewTarget)
        )
      : [];
    const sources = Array.isArray(parsed.sources)
      ? parsed.sources.filter(
          (s): s is string => typeof s === "string" && s.trim().length > 0
        )
      : [];

    const rawCount =
      typeof parsed.count === "number"
        ? parsed.count
        : typeof parsed.count === "string"
          ? Number(parsed.count)
          : NaN;
    const count =
      Number.isFinite(rawCount) && rawCount >= 1 && rawCount <= 100
        ? Math.round(rawCount)
        : base.count;

    return {
      mode: VALID_MODES.has(parsed.mode as ReviewMode)
        ? (parsed.mode as ReviewMode)
        : base.mode,
      direction: VALID_DIRECTIONS.has(
        parsed.direction as ReviewSettings["direction"]
      )
        ? (parsed.direction as ReviewSettings["direction"])
        : base.direction,
      testFormat: VALID_TEST_FORMATS.has(parsed.testFormat as TestType)
        ? (parsed.testFormat as TestType)
        : base.testFormat,
      targets: targets.length ? targets : base.targets,
      sources,
      count,
    };
  } catch {
    return defaults();
  }
}

export function saveReviewPrefs(userId: string, data: StoredReviewPrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_KEY}:${userId}`, JSON.stringify(data));
  } catch {
    /* ignore quota / private mode */
  }
}

/** @deprecated use loadReviewPrefs */
export const loadReviewTargets = loadReviewPrefs;
/** @deprecated use saveReviewPrefs */
export const saveReviewTargets = saveReviewPrefs;
