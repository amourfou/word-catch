import {
  startOfMonthSeoulIso,
  startOfTodaySeoulIso,
  startOfWeekSeoulIso,
} from "@/lib/date";
import type {
  ReviewDirection,
  ReviewMode,
  TestType,
  WordRow,
  WordStatus,
} from "@/lib/supabase";

export type ReviewTarget =
  | "today"
  | "week"
  | "month"
  | "unknown"
  | "learning"
  | "mastered"
  | "all";

export interface ReviewSettings {
  mode: ReviewMode;
  direction: "en_to_ko" | "ko_to_en" | "mixed";
  targets: ReviewTarget[];
  /** Empty = no source filter. When set, AND with status/date targets. */
  sources: string[];
  count: number;
}

export interface ReviewItem {
  word: WordRow;
  direction: ReviewDirection;
  testType: TestType | null;
  choices: string[] | null;
  prompt: string;
  correctAnswer: string;
}

export interface SessionAnswer {
  wordId: string;
  word: string;
  isCorrect: boolean;
  userAnswer: string;
  correctAnswer: string;
  mode: ReviewMode;
  testType: TestType | null;
  direction: ReviewDirection | null;
}

export interface ReviewSessionState {
  settings: ReviewSettings;
  items: ReviewItem[];
  answers: SessionAnswer[];
  startedAt: string;
}

export const SESSION_STORAGE_KEY = "wordcatch-review-session";
export const RESULT_STORAGE_KEY = "wordcatch-review-result";

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** KO↔EN: any one of meanings matching (or word for en side). */
export function gradeAnswer(
  direction: ReviewDirection,
  word: WordRow,
  userAnswer: string
): boolean {
  const normalized = normalizeAnswer(userAnswer);
  if (!normalized) return false;

  if (direction === "ko_to_en") {
    return normalizeAnswer(word.word) === normalized;
  }

  // en_to_ko — any meaning
  return word.meanings.some((m) => normalizeAnswer(m) === normalized);
}

export function shouldUseDirectInput(word: WordRow): boolean {
  return word.status !== "unknown" || word.correct_streak >= 1;
}

function pickDirection(
  setting: ReviewSettings["direction"]
): ReviewDirection {
  if (setting === "mixed") {
    return Math.random() < 0.5 ? "en_to_ko" : "ko_to_en";
  }
  return setting;
}

function buildChoices(
  word: WordRow,
  direction: ReviewDirection,
  pool: WordRow[]
): string[] {
  const correct =
    direction === "en_to_ko"
      ? word.meanings[0] ?? ""
      : word.word;

  const distractors: string[] = [];
  const others = shuffle(pool.filter((w) => w.id !== word.id));

  for (const w of others) {
    if (distractors.length >= 3) break;
    if (direction === "en_to_ko") {
      const m = w.meanings[0];
      if (m && normalizeAnswer(m) !== normalizeAnswer(correct) && !distractors.includes(m)) {
        distractors.push(m);
      }
    } else {
      if (
        normalizeAnswer(w.word) !== normalizeAnswer(correct) &&
        !distractors.includes(w.word)
      ) {
        distractors.push(w.word);
      }
    }
  }

  // pad if not enough
  const pads = ["(보기 부족)", "—", "···", "?"];
  let i = 0;
  while (distractors.length < 3) {
    distractors.push(`${pads[i % pads.length]} ${distractors.length + 1}`);
    i++;
  }

  return shuffle([correct, ...distractors.slice(0, 3)]);
}

export function buildReviewItems(
  words: WordRow[],
  settings: ReviewSettings,
  poolForChoices: WordRow[]
): ReviewItem[] {
  const picked = shuffle(words).slice(0, settings.count);

  return picked.map((word) => {
    const direction =
      settings.mode === "flashcard" ? "en_to_ko" : pickDirection(settings.direction);

    let testType: TestType | null = null;
    let choices: string[] | null = null;
    let prompt = word.word;
    let correctAnswer = word.meanings.join(", ");

    if (settings.mode === "test") {
      testType = shouldUseDirectInput(word) ? "direct_input" : "multiple_choice";
      if (direction === "en_to_ko") {
        prompt = word.word;
        correctAnswer = word.meanings[0] ?? "";
      } else {
        prompt = word.meanings[0] ?? "";
        correctAnswer = word.word;
      }
      if (testType === "multiple_choice") {
        choices = buildChoices(word, direction, poolForChoices);
      }
    }

    return { word, direction, testType, choices, prompt, correctAnswer };
  });
}

const STATUS_DATE_TARGETS: ReviewTarget[] = [
  "today",
  "week",
  "month",
  "unknown",
  "learning",
  "mastered",
];

export function filterWordsByTargets(
  words: WordRow[],
  targets: ReviewTarget[],
  sources: string[] = []
): WordRow[] {
  const set = new Set(targets);
  const todayIso = startOfTodaySeoulIso();
  const weekIso = startOfWeekSeoulIso();
  const monthIso = startOfMonthSeoulIso();
  const hasStatusDate = STATUS_DATE_TARGETS.some((t) => set.has(t));
  const hasAll = set.has("all");

  if (hasAll && sources.length === 0) return words;

  return words.filter((w) => {
    const sourceOk =
      sources.length === 0 ||
      (!!w.source && sources.includes(w.source));
    if (!sourceOk) return false;

    if (hasAll || !hasStatusDate) return true;

    if (set.has("today") && w.created_at >= todayIso) return true;
    if (set.has("week") && w.created_at >= weekIso) return true;
    if (set.has("month") && w.created_at >= monthIso) return true;
    if (set.has("unknown") && w.status === "unknown") return true;
    if (set.has("learning") && w.status === "learning") return true;
    if (set.has("mastered") && w.status === "mastered") return true;
    return false;
  });
}

export function defaultReviewSettings(): ReviewSettings {
  return {
    mode: "test",
    direction: "mixed",
    targets: ["today", "unknown", "learning"],
    sources: [],
    count: 10,
  };
}

export function saveSession(state: ReviewSessionState): void {
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
}

export function loadSession(): ReviewSessionState | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ReviewSessionState;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

export function saveResult(state: ReviewSessionState): void {
  sessionStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(state));
}

export function loadResult(): ReviewSessionState | null {
  try {
    const raw = sessionStorage.getItem(RESULT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ReviewSessionState;
  } catch {
    return null;
  }
}

export type StatusCounts = Record<WordStatus, number>;
