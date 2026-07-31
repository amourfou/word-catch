import type { DictionaryEntry } from "@/lib/dictionary";
import { supabase, type DictionaryRow } from "@/lib/supabase";

export function normalizeWordKey(word: string): string {
  return word.trim().toLowerCase().split(/\s+/)[0]?.replace(/[^a-z'-]/g, "") ?? "";
}

export async function getCachedDictionaryEntry(
  wordKey: string
): Promise<DictionaryEntry | null> {
  const { data, error } = await supabase
    .from("wordcatch_dictionary")
    .select("entry")
    .eq("word_key", wordKey)
    .maybeSingle();
  if (error) {
    console.error("getCachedDictionaryEntry", error);
    return null;
  }
  const entry = data?.entry as DictionaryEntry | null | undefined;
  if (!entry || typeof entry !== "object" || !entry.word) return null;
  return entry;
}

export async function saveDictionaryCache(params: {
  wordKey: string;
  entry: DictionaryEntry;
  raw: unknown;
}): Promise<DictionaryRow | null> {
  const fields = {
    word: params.entry.word,
    phonetic: params.entry.phonetic?.trim() || null,
    audio_url: params.entry.audio?.trim() || null,
    entry: params.entry,
    raw: params.raw,
    source: params.entry.source ?? "learners",
  };

  const { data: existing } = await supabase
    .from("wordcatch_dictionary")
    .select("id")
    .eq("word_key", params.wordKey)
    .maybeSingle();

  if (existing?.id) {
    const { data, error } = await supabase
      .from("wordcatch_dictionary")
      .update(fields)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) {
      console.error("saveDictionaryCache update", error);
      return null;
    }
    return data as DictionaryRow;
  }

  const { data, error } = await supabase
    .from("wordcatch_dictionary")
    .insert([{ word_key: params.wordKey, ...fields, learner_user_ids: [] }])
    .select()
    .single();

  if (error) {
    // Concurrent insert — fill entry on the winner row
    if (error.code === "23505") {
      const { data: raced, error: updateError } = await supabase
        .from("wordcatch_dictionary")
        .update(fields)
        .eq("word_key", params.wordKey)
        .select()
        .single();
      if (updateError) {
        console.error("saveDictionaryCache race update", updateError);
        return null;
      }
      return raced as DictionaryRow;
    }
    console.error("saveDictionaryCache insert", error);
    return null;
  }
  return data as DictionaryRow;
}

/**
 * Append userId to learner_user_ids only when an exact cached dictionary
 * entry already exists. Does not create rows for unverified / inexact words.
 */
export async function addDictionaryLearner(params: {
  userId: string;
  word: string;
}): Promise<string | null> {
  const wordKey = normalizeWordKey(params.word);
  if (!wordKey) return null;

  const { data: existing, error: readError } = await supabase
    .from("wordcatch_dictionary")
    .select("id, learner_user_ids, entry")
    .eq("word_key", wordKey)
    .maybeSingle();

  if (readError) {
    console.error("addDictionaryLearner read", readError);
    return null;
  }

  if (!existing?.entry) return null;

  const ids = (existing.learner_user_ids as string[] | null) ?? [];
  if (!ids.includes(params.userId)) {
    const { error: updateError } = await supabase
      .from("wordcatch_dictionary")
      .update({ learner_user_ids: [...ids, params.userId] })
      .eq("id", existing.id);
    if (updateError) console.error("addDictionaryLearner update", updateError);
  }
  return existing.id as string;
}
