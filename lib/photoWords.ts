/**
 * 사진 → 단어 추출 결과 정리 (순수 함수, 서버·클라이언트·테스트 공용).
 * DB나 네트워크를 쓰지 않는다.
 */
import { PARTS_OF_SPEECH } from "@/lib/pos";

export type PhotoWordItem = {
  word: string;
  meanings: string[];
  part_of_speech: string;
  phonetic: string;
  example: string;
};

export type ReviewItem = PhotoWordItem & {
  key: string;
  /** 이미 내 단어장에 있는 단어 */
  duplicate: boolean;
  /** 같은 사진 안에서 앞에 이미 나온 단어 */
  repeatedInPhoto: boolean;
  checked: boolean;
};

export const MAX_ITEMS = 80;
const MAX_WORD = 60;
const MAX_MEANING = 80;

const POS_VALUES = new Set<string>(PARTS_OF_SPEECH.map((p) => p.value));
const POS_ALIASES: Record<string, string> = {
  n: "n.", noun: "n.", 명: "n.", 명사: "n.",
  v: "v.", verb: "v.", 동: "v.", 동사: "v.",
  vt: "vt.", 타동사: "vt.", vi: "vi.", 자동사: "vi.",
  a: "adj.", adj: "adj.", adjective: "adj.", 형: "adj.", 형용사: "adj.",
  ad: "adv.", adv: "adv.", adverb: "adv.", 부: "adv.", 부사: "adv.",
  prep: "prep.", 전: "prep.", 전치사: "prep.",
  conj: "conj.", 접: "conj.", 접속사: "conj.",
  pron: "pron.", 대: "pron.", 대명사: "pron.",
  det: "det.", 한정사: "det.",
  phrv: "phr.v.", "phr.v": "phr.v.", 구동사: "phr.v.",
  phr: "phr.", 숙어: "phr.", 구: "phr.",
};

export function normalizePos(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const t = raw.trim().toLowerCase();
  if (!t) return "";
  if (POS_VALUES.has(t)) return t;
  const bare = t.replace(/\.$/, "");
  return POS_ALIASES[bare] ?? POS_ALIASES[bare.replace(/\./g, "")] ?? "";
}

/** 비교용 키: 소문자, 앞뒤 공백·양끝 문장부호 제거, 공백 하나로 */
export function wordKey(word: string): string {
  return word
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/^[^a-z0-9]+|[^a-z0-9.')]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 단어 글자 정리: 번호(1. / ①) 제거, 공백 정리 */
export function cleanWord(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/^\s*[\u2460-\u2473]\s*/, "")
    .normalize("NFKC")
    .replace(/^\s*\d{1,3}[.)]\s*/, "")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_WORD);
}

/**
 * 뜻 문자열을 여러 뜻으로 나눈다. 쉼표·세미콜론·슬래시·①② 기준,
 * 괄호 안의 쉼표는 자르지 않는다. 같은 뜻은 한 번만.
 */
export function splitMeanings(raw: unknown): string[] {
  const parts: string[] = [];
  const push = (s: string) => {
    const t = s.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, MAX_MEANING);
    if (t && !parts.includes(t)) parts.push(t);
  };
  const list = Array.isArray(raw) ? raw : [raw];
  for (const item of list) {
    if (typeof item !== "string") continue;
    let depth = 0;
    let buf = "";
    for (const ch of item) {
      if ("([{".includes(ch)) depth += 1;
      if (")]}".includes(ch)) depth = Math.max(0, depth - 1);
      const isSep = depth === 0 && (ch === "," || ch === ";" || ch === "/" || ch === "\n" || /[\u2460-\u2473]/.test(ch));
      if (isSep) {
        push(buf);
        buf = "";
      } else buf += ch;
    }
    push(buf);
  }
  return parts.slice(0, 8);
}

/** 영어 단어/숙어처럼 보이는지 (라틴 문자 포함, 한글 없음) */
export function looksEnglish(word: string): boolean {
  return /[a-zA-Z]/.test(word) && !/[\uac00-\ud7a3]/.test(word);
}

/** AI JSON(이미 파싱된 값)을 안전한 항목 목록으로. 이상한 값은 버린다. */
export function parseExtraction(raw: unknown): PhotoWordItem[] {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const arr = Array.isArray(obj.items) ? obj.items : Array.isArray(raw) ? raw : [];
  const out: PhotoWordItem[] = [];
  for (const it of arr) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const word = cleanWord(o.word);
    const meanings = splitMeanings(o.meanings ?? o.meaning);
    if (!word || !looksEnglish(word) || meanings.length === 0) continue;
    out.push({
      word,
      meanings,
      part_of_speech: normalizePos(o.part_of_speech ?? o.pos),
      phonetic: typeof o.phonetic === "string" ? o.phonetic.trim().slice(0, 60) : "",
      example: typeof o.example === "string" ? o.example.trim().slice(0, 200) : "",
    });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

/** AI 응답 텍스트 → 항목. JSON이 깨졌으면 빈 목록. */
export function parseExtractionText(text: string): PhotoWordItem[] {
  try {
    return parseExtraction(JSON.parse(text));
  } catch {
    return [];
  }
}

/**
 * 중복 표시: 내 단어장에 있으면 duplicate, 사진 안에서 반복되면 repeatedInPhoto.
 * 둘 다 기본 체크 해제.
 */
export function markDuplicates(items: PhotoWordItem[], existingWords: string[]): ReviewItem[] {
  const existing = new Set(existingWords.map(wordKey).filter(Boolean));
  const seen = new Set<string>();
  return items.map((it, i) => {
    const k = wordKey(it.word);
    const duplicate = existing.has(k);
    const repeatedInPhoto = seen.has(k);
    seen.add(k);
    return { ...it, key: `${i}-${k}`, duplicate, repeatedInPhoto, checked: !duplicate && !repeatedInPhoto };
  });
}

/** 저장 직전 검사: 체크된 것 중 단어·뜻이 있는 것만, 사진 안 중복은 처음 것만. */
export function itemsToSave(items: ReviewItem[], existingWords: string[]): PhotoWordItem[] {
  const existing = new Set(existingWords.map(wordKey));
  const seen = new Set<string>();
  const out: PhotoWordItem[] = [];
  for (const it of items) {
    if (!it.checked) continue;
    const word = cleanWord(it.word);
    const meanings = splitMeanings(it.meanings);
    const k = wordKey(word);
    if (!word || !meanings.length || existing.has(k) || seen.has(k)) continue;
    seen.add(k);
    out.push({ ...it, word, meanings });
  }
  return out;
}

/** OpenAI 구조화 출력 스키마 */
export const PHOTO_WORDS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["word", "meanings", "part_of_speech", "phonetic", "example"],
        properties: {
          word: { type: "string" },
          meanings: { type: "array", items: { type: "string" } },
          part_of_speech: { type: "string" },
          phonetic: { type: "string" },
          example: { type: "string" },
        },
      },
    },
  },
} as const;

export const PHOTO_WORDS_PROMPT = [
  "이 사진은 영어 단어장/학습지야. 영어 단어(또는 숙어)와 한국어 뜻 짝을 사진에 보이는 순서대로 모두 뽑아.",
  "- word: 사진에 적힌 영어 철자 그대로(번호·기호 빼고). 철자를 고치거나 추측해서 바꾸지 마.",
  "- meanings: 사진에 적힌 한국어 뜻. 뜻이 여러 개면 배열로 나눠.",
  "- part_of_speech: 사진에 품사가 있으면 n./v./adj./adv. 같은 약어, 없으면 빈 문자열.",
  "- phonetic, example: 사진에 그대로 적혀 있을 때만, 없으면 빈 문자열. 지어내지 마.",
  "- 뜻이 안 보이는 단어, 제목·쪽번호·문제 지시문은 빼.",
].join("\n");
