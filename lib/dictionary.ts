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
  const entries =
    q != null
      ? all.filter((e) => entryHeadword(e) === q)
      : all;
  const matched = entries.length > 0 ? entries : [all[0]];

  const first = matched[0];
  const word =
    first.meta?.id?.split(":")[0] ||
    first.hwi?.hw?.replace(/\*/g, "") ||
    "";
  if (!word) return null;

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
      .map((d, i) => {
        const definition = cleanMwText(d);
        if (!definition) return null;
        return {
          definition,
          example: i === 0 ? example : undefined,
        } satisfies DictionaryDefinition;
      })
      .filter((d): d is DictionaryDefinition => d !== null);

    if (defs.length === 0) continue;
    const existing = byPos.get(pos) ?? [];
    byPos.set(pos, [...existing, ...defs].slice(0, 3));
  }

  const meanings = [...byPos.entries()].map(([partOfSpeech, definitions]) => ({
    partOfSpeech,
    definitions,
  }));

  if (meanings.length === 0) return null;

  return {
    word,
    phonetic,
    audio,
    meanings,
    source: "learners",
  };
}

export async function fetchDictionaryEntry(
  word: string
): Promise<
  | { ok: true; entry: DictionaryEntry }
  | { ok: false; message: string }
> {
  const trimmed = word.trim();
  if (!trimmed) return { ok: false, message: "단어가 비어 있어요." };

  try {
    const res = await fetch(
      `/api/dictionary?word=${encodeURIComponent(trimmed)}`
    );
    const data = (await res.json()) as {
      entry?: DictionaryEntry;
      message?: string;
    };
    if (!res.ok || !data.entry) {
      return {
        ok: false,
        message: data.message ?? "사전에서 찾을 수 없어요.",
      };
    }
    return { ok: true, entry: data.entry };
  } catch {
    return { ok: false, message: "사전을 불러오지 못했어요." };
  }
}
