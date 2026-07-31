/** Common school English parts of speech */
export const PARTS_OF_SPEECH = [
  { value: "n.", label: "n. 명사" },
  { value: "v.", label: "v. 동사" },
  { value: "vt.", label: "vt. 타동사" },
  { value: "vi.", label: "vi. 자동사" },
  { value: "adj.", label: "adj. 형용사" },
  { value: "adv.", label: "adv. 부사" },
  { value: "prep.", label: "prep. 전치사" },
  { value: "conj.", label: "conj. 접속사" },
  { value: "pron.", label: "pron. 대명사" },
  { value: "det.", label: "det. 한정사" },
  { value: "phr.v.", label: "phr.v. 구동사" },
  { value: "phr.", label: "phr. 구·숙어" },
] as const;

export type PartOfSpeechValue = (typeof PARTS_OF_SPEECH)[number]["value"];

/** Longer labels first so `phr.v.` wins over `v.` / `phr.` */
const POS_PREFIXES = [...PARTS_OF_SPEECH]
  .map((p) => p.value)
  .sort((a, b) => b.length - a.length);

/** "vt. 주저하다" — POS omitted if empty. */
export function formatMeaningEntry(pos: string, text: string): string {
  const body = meaningTextOnly(text);
  if (!body) return "";
  const p = pos.trim();
  if (!p) return body;
  return `${p} ${body}`;
}

/** Strip a known POS prefix → "주저하다". */
export function meaningTextOnly(entry: string): string {
  const t = entry.trim();
  if (!t) return "";
  for (const pos of POS_PREFIXES) {
    if (t === pos) return "";
    if (t.startsWith(`${pos} `) || t.startsWith(`${pos}\t`)) {
      return t.slice(pos.length).trim();
    }
  }
  return t;
}

/** POS prefix of a stored meaning, or null. */
export function meaningPos(entry: string): string | null {
  const t = entry.trim();
  for (const pos of POS_PREFIXES) {
    if (t === pos || t.startsWith(`${pos} `) || t.startsWith(`${pos}\t`)) {
      return pos;
    }
  }
  return null;
}
