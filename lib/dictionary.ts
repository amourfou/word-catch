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
}

type ApiPhonetic = { text?: string; audio?: string };
type ApiDefinition = {
  definition: string;
  example?: string;
  synonyms?: string[];
};
type ApiMeaning = {
  partOfSpeech: string;
  definitions: ApiDefinition[];
};
type ApiEntry = {
  word: string;
  phonetic?: string;
  phonetics?: ApiPhonetic[];
  meanings: ApiMeaning[];
};

export function parseDictionaryResponse(data: unknown): DictionaryEntry | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  const entry = data[0] as ApiEntry;
  if (!entry?.word || !entry.meanings) return null;

  const phonetic =
    entry.phonetic ||
    entry.phonetics?.find((p) => p.text)?.text ||
    undefined;
  const audio =
    entry.phonetics?.find((p) => p.audio)?.audio || undefined;

  return {
    word: entry.word,
    phonetic,
    audio: audio || undefined,
    meanings: entry.meanings.map((m) => ({
      partOfSpeech: m.partOfSpeech,
      definitions: (m.definitions ?? []).slice(0, 3).map((d) => ({
        definition: d.definition,
        example: d.example,
        synonyms: d.synonyms?.slice(0, 5),
      })),
    })),
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
