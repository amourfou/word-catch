import type { DateFilter } from "@/lib/db";
import type { WordStatus } from "@/lib/supabase";

const STORAGE_KEY = "wordcatch-words-filters";

export interface WordsListFilters {
  status: WordStatus | "all";
  source: string | "all";
  date: DateFilter;
  search: string;
}

export const DEFAULT_WORDS_FILTERS: WordsListFilters = {
  status: "all",
  source: "all",
  date: "all",
  search: "",
};

const STATUSES = new Set(["all", "unknown", "learning", "mastered"]);
const DATES = new Set(["all", "today", "week", "month"]);

export function loadWordsFilters(userId: string): WordsListFilters {
  if (typeof window === "undefined") return DEFAULT_WORDS_FILTERS;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${userId}`);
    if (!raw) return DEFAULT_WORDS_FILTERS;
    const parsed = JSON.parse(raw) as Partial<WordsListFilters>;
    return {
      status: STATUSES.has(parsed.status ?? "")
        ? (parsed.status as WordsListFilters["status"])
        : "all",
      source:
        typeof parsed.source === "string" && parsed.source.trim()
          ? parsed.source
          : "all",
      date: DATES.has(parsed.date ?? "")
        ? (parsed.date as DateFilter)
        : "all",
      search: typeof parsed.search === "string" ? parsed.search : "",
    };
  } catch {
    return DEFAULT_WORDS_FILTERS;
  }
}

export function saveWordsFilters(userId: string, filters: WordsListFilters): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_KEY}:${userId}`, JSON.stringify(filters));
  } catch {
    /* ignore quota / private mode */
  }
}
