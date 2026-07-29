import type { WordStatus } from "@/lib/supabase";

export interface MasteryState {
  status: WordStatus;
  wrong_count: number;
  correct_streak: number;
}

/** Apply flashcard/test outcome to mastery fields. */
export function applyMasteryResult(
  current: MasteryState,
  isCorrect: boolean
): MasteryState {
  if (!isCorrect) {
    return {
      status: "unknown",
      wrong_count: current.wrong_count + 1,
      correct_streak: 0,
    };
  }

  const streak = current.correct_streak + 1;
  let status = current.status;

  if (current.status === "unknown") {
    status = "learning";
  } else if (current.status === "learning" && streak >= 2) {
    status = "mastered";
  }
  // mastered stays mastered on success

  return {
    status,
    wrong_count: current.wrong_count,
    correct_streak: streak,
  };
}

export const STATUS_LABEL: Record<WordStatus, string> = {
  unknown: "모름",
  learning: "아는 중",
  mastered: "외움",
};
