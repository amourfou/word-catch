export interface DictionaryDefinition {
  definition: string;
  example?: string;
  synonyms?: string[];
}

export interface DictionaryMeaning {
  partOfSpeech: string;
  definitions: DictionaryDefinition[];
}

export interface DictionaryEntry {
  word: string;
  phonetic?: string;
  audio?: string;
  meanings: DictionaryMeaning[];
  source?: "learners";
}

type MwPronunciation = {
  ipa?: string;
  mw?: string;
  sound?: { audio?: string };
};

type MwEntry = {
  meta?: { id?: string };
  hwi?: {
    hw?: string;
    prs?: MwPronunciation[];
  };
  fl?: string;
  shortdef?: string[];
  def?: Array<{
    sseq?: unknown[][];
  }>;
};

/** Strip Merriam-Webster markup tokens from definition/example text. */
export function cleanMwText(text: string): string {
  return text
    .replace(/\{bc\}/g, "")
    .replace(/\{ldquo\}/g, "“")
    .replace(/\{rdquo\}/g, "”")
    .replace(/\{mdash\}/g, "—")
    .replace(/\{([^|}]+)\|([^|}]+)[^}]*\}/g, "$2")
    .replace(/\{\/?[\w.]+\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildMwAudioUrl(audio: string): string {
  let subdirectory: string;
  if (audio.startsWith("bix")) subdirectory = "bix";
  else if (audio.startsWith("gg")) subdirectory = "gg";
  else if (/^[^a-zA-Z]/.test(audio)) subdirectory = "number";
  else subdirectory = audio[0].toLowerCase();

  return `https://media.merriam-webster.com/audio/prons/en/us/mp3/${subdirectory}/${audio}.mp3`;
}

function extractFirstExample(entry: MwEntry): string | undefined {
  for (const block of entry.def ?? []) {
    for (const sseq of block.sseq ?? []) {
      for (const item of sseq) {
        if (!Array.isArray(item) || item[0] !== "sense") continue;
        const sense = item[1] as { dt?: unknown[] };
        for (const dt of sense.dt ?? []) {
          if (!Array.isArray(dt) || dt[0] !== "vis") continue;
          const vis = dt[1] as Array<{ t?: string }> | undefined;
          const raw = vis?.[0]?.t;
          if (raw) return cleanMwText(raw);
        }
      }
    }
  }
  return undefined;
}

function entryHeadword(entry: MwEntry): string {
  return (
    entry.meta?.id?.split(":")[0] ||
    entry.hwi?.hw?.replace(/\*/g, "") ||
    ""
  ).toLowerCase();
}

export function parseLearnersResponse(
  data: unknown,
  queryWord?: string
): DictionaryEntry | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  // Not found → spelling suggestions (array of strings)
  if (typeof data[0] === "string") return null;

  const all = data.filter(
    (e): e is MwEntry =>
      typeof e === "object" && e !== null && ("meta" in e || "hwi" in e)
  );
  if (all.length === 0) return null;

  const q = queryWord?.toLowerCase();
  const matched =
    q != null ? all.filter((e) => entryHeadword(e) === q) : all;
  // No fuzzy fallback — headword must match the query exactly.
  if (matched.length === 0) return null;

  const first = matched[0];
  const word =
    first.meta?.id?.split(":")[0] ||
    first.hwi?.hw?.replace(/\*/g, "") ||
    "";
  if (!word) return null;
  if (q != null && word.toLowerCase() !== q) return null;

  const pr = first.hwi?.prs?.[0];
  const phonetic = pr?.ipa
    ? `/${pr.ipa}/`
    : pr?.mw
      ? `/${pr.mw}/`
      : undefined;
  const audio = pr?.sound?.audio
    ? buildMwAudioUrl(pr.sound.audio)
    : undefined;

  const byPos = new Map<string, DictionaryDefinition[]>();

  for (const entry of matched.slice(0, 4)) {
    const pos = entry.fl ?? "other";
    const example = extractFirstExample(entry);
    const defs = (entry.shortdef ?? [])
      .slice(0, 3)
      .map((d, i): DictionaryDefinition | null => {
        const definition = cleanMwText(d);
        if (!definition) return null;
        if (i === 0 && example) return { definition, example };
        return { definition };
      })
      .filter((d): d is DictionaryDefinition => d !== null);

    if (defs.length === 0) continue;
    const existing = byPos.get(pos) ?? [];
    byPos.set(pos, [...existing, ...defs].slice(0, 3));
  }

  const meanings = Array.from(byPos.entries()).map(
    ([partOfSpeech, definitions]) => ({
      partOfSpeech,
      definitions,
    })
  );

  if (meanings.length === 0) return null;

  return {
    word,
    phonetic,
    audio,
    meanings,
    source: "learners",
  };
}

export type DictionaryLookupResult =
  | { ok: true; exact: true; entry: DictionaryEntry }
  | { ok: true; exact: false; suggested?: string }
  | { ok: false; message: string };

export async function fetchDictionaryEntry(
  word: string
): Promise<DictionaryLookupResult> {
  const trimmed = word.trim();
  if (!trimmed) return { ok: false, message: "단어가 비어 있어요." };

  try {
    const res = await fetch(
      `/api/dictionary?word=${encodeURIComponent(trimmed)}`
    );
    const data = (await res.json()) as {
      entry?: DictionaryEntry;
      exact?: boolean;
      suggested?: string;
      message?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        message: data.message ?? "사전에서 찾을 수 없어요.",
      };
    }
    if (data.exact === false) {
      return { ok: true, exact: false, suggested: data.suggested };
    }
    if (!data.entry) {
      return {
        ok: false,
        message: data.message ?? "사전에서 찾을 수 없어요.",
      };
    }
    return { ok: true, exact: true, entry: data.entry };
  } catch {
    return { ok: false, message: "사전을 불러오지 못했어요." };
  }
}

/** First headword in a MW payload (may not match the query). */
export function peekLearnersHeadword(data: unknown): string | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  if (typeof data[0] === "string") return null;
  const first = data.find(
    (e): e is MwEntry =>
      typeof e === "object" && e !== null && ("meta" in e || "hwi" in e)
  );
  if (!first) return null;
  const word =
    first.meta?.id?.split(":")[0] ||
    first.hwi?.hw?.replace(/\*/g, "") ||
    "";
  return word || null;
}
