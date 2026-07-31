import { meaningTextOnly } from "@/lib/pos";

/**
 * Search patterns (case-insensitive):
 * - `h` or `h*`  → starts with h
 * - `*h`         → ends with h
 * - `*h*`        → contains h
 *
 * Target field:
 * - Query (ignoring *) starts with Hangul → match meanings (뜻)
 * - Otherwise → match English word
 */
export function matchSearchPattern(text: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const t = text.toLowerCase();

  if (q.startsWith("*") && q.endsWith("*") && q.length >= 2) {
    const inner = q.slice(1, -1);
    if (!inner) return true;
    return t.includes(inner);
  }
  if (q.startsWith("*")) {
    const inner = q.slice(1);
    if (!inner) return true;
    return t.endsWith(inner);
  }
  if (q.endsWith("*")) {
    const inner = q.slice(0, -1);
    if (!inner) return true;
    return t.startsWith(inner);
  }
  return t.startsWith(q);
}

function firstSignificantChar(query: string): string {
  const stripped = query.trim().replace(/^\*+/, "").replace(/\*+$/, "");
  return stripped.charAt(0);
}

/** Hangul syllable / jamo → search by meaning */
export function isMeaningSearchQuery(query: string): boolean {
  const ch = firstSignificantChar(query);
  if (!ch) return false;
  const code = ch.codePointAt(0) ?? 0;
  return (
    (code >= 0xac00 && code <= 0xd7a3) || // syllables
    (code >= 0x1100 && code <= 0x11ff) || // jamo
    (code >= 0x3130 && code <= 0x318f) // compatibility jamo
  );
}

export function wordMatchesSearch(
  word: string,
  meanings: string[],
  query: string
): boolean {
  if (!query.trim()) return true;
  if (isMeaningSearchQuery(query)) {
    return meanings.some(
      (m) =>
        matchSearchPattern(m, query) ||
        matchSearchPattern(meaningTextOnly(m), query)
    );
  }
  return matchSearchPattern(word, query);
}
