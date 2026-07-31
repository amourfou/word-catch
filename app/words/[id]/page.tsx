"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Plus, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { WordVerifyField } from "@/components/WordVerifyField";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { deleteWord, getWord, listSources, updateWord } from "@/lib/db";
import {
  PARTS_OF_SPEECH,
  formatMeaningEntry,
  meaningPos,
  meaningTextOnly,
} from "@/lib/pos";
import type { SourceRow, WordIdiom, WordRow } from "@/lib/supabase";

export default function WordDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();
  const meaningRef = useRef<HTMLInputElement>(null);
  const [wordRow, setWordRow] = useState<WordRow | null>(null);
  const [word, setWord] = useState("");
  const [phonetic, setPhonetic] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [meaningDraft, setMeaningDraft] = useState("");
  const [meanings, setMeanings] = useState<string[]>([]);
  const [source, setSource] = useState("");
  const [partOfSpeech, setPartOfSpeech] = useState("");
  const [idiomPhrase, setIdiomPhrase] = useState("");
  const [idiomMeaning, setIdiomMeaning] = useState("");
  const [idioms, setIdioms] = useState<WordIdiom[]>([]);
  const [memo, setMemo] = useState("");
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setLoading(true);
      const [row, srcs] = await Promise.all([
        getWord(user.id, id),
        listSources(user.id),
      ]);
      setSources(srcs);
      if (!row) {
        setWordRow(null);
        setLoading(false);
        return;
      }
      setWordRow(row);
      setWord(row.word);
      setPhonetic(row.phonetic ?? "");
      setAudioUrl(row.audio_url ?? "");
      setMeanings(row.meanings.length ? row.meanings : []);
      setMeaningDraft("");
      setSource(row.source ?? "");
      setPartOfSpeech(
        row.part_of_speech || meaningPos(row.meanings[0] ?? "") || ""
      );
      setIdioms(
        Array.isArray(row.idioms)
          ? row.idioms.filter(
              (x): x is WordIdiom =>
                !!x &&
                typeof x === "object" &&
                typeof x.phrase === "string" &&
                typeof x.meaning === "string"
            )
          : []
      );
      setIdiomPhrase("");
      setIdiomMeaning("");
      setMemo(row.memo ?? "");
      setLoading(false);
    })();
  }, [user, id]);

  const addMeaning = () => {
    const entry = formatMeaningEntry(partOfSpeech, meaningDraft);
    if (!entry) return;
    if (
      meanings.some(
        (m) =>
          m === entry ||
          meaningTextOnly(m) === meaningTextOnly(entry)
      )
    ) {
      setMeaningDraft("");
      return;
    }
    setMeanings((prev) => [...prev, entry]);
    setMeaningDraft("");
    meaningRef.current?.focus();
  };

  const collectMeanings = () => {
    const entry = formatMeaningEntry(partOfSpeech, meaningDraft);
    const list = [...meanings];
    if (
      entry &&
      !list.some(
        (m) =>
          m === entry ||
          meaningTextOnly(m) === meaningTextOnly(entry)
      )
    ) {
      list.push(entry);
    }
    return list;
  };

  const addIdiom = () => {
    const phrase = idiomPhrase.trim();
    const meaning = idiomMeaning.trim();
    if (!phrase || !meaning) return;
    if (idioms.some((x) => x.phrase.toLowerCase() === phrase.toLowerCase())) {
      setIdiomPhrase("");
      setIdiomMeaning("");
      return;
    }
    setIdioms((prev) => [...prev, { phrase, meaning }]);
    setIdiomPhrase("");
    setIdiomMeaning("");
  };

  const collectIdioms = (): WordIdiom[] => {
    const phrase = idiomPhrase.trim();
    const meaning = idiomMeaning.trim();
    const list = [...idioms];
    if (
      phrase &&
      meaning &&
      !list.some((x) => x.phrase.toLowerCase() === phrase.toLowerCase())
    ) {
      list.push({ phrase, meaning });
    }
    return list;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const finalMeanings = collectMeanings();
    if (finalMeanings.length === 0) {
      setError("뜻을 하나 이상 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const updated = await updateWord(user.id, id, {
        word,
        meanings: finalMeanings,
        source,
        part_of_speech:
          meaningPos(finalMeanings[0] ?? "") || partOfSpeech || null,
        phonetic: phonetic || null,
        audio_url: audioUrl || null,
        idioms: collectIdioms(),
        memo,
      });
      setWordRow(updated);
      router.push("/words");
    } catch (err) {
      setError(err instanceof Error ? err.message : "수정 실패");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!user || !confirm("이 단어를 삭제할까요?")) return;
    setBusy(true);
    try {
      await deleteWord(user.id, id);
      router.push("/words");
    } catch {
      setError("삭제에 실패했어요.");
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground">불러오는 중…</p>;
  }
  if (!wordRow) {
    return <p className="text-muted-foreground">단어를 찾을 수 없어요.</p>;
  }

  const knownPos = PARTS_OF_SPEECH.some((p) => p.value === partOfSpeech);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 gap-0.5 px-2 text-muted-foreground"
          disabled={busy}
          onClick={() => router.push("/words")}
        >
          <ChevronLeft className="h-4 w-4" />
          이전
        </Button>
        <StatusBadge status={wordRow.status} />
      </div>
      <h1 className="font-display text-[length:var(--title-lg)] font-semibold">
        단어 수정
      </h1>

      <form onSubmit={onSubmit} className="space-y-2.5">
        <WordVerifyField
          word={word}
          onWordChange={setWord}
          phonetic={phonetic}
          onPhoneticChange={setPhonetic}
          audioUrl={audioUrl}
          onAudioUrlChange={setAudioUrl}
          required
          placeholder="영어 단어"
        />

        <div>
          <div className="flex gap-2">
            <Select
              id="pos"
              value={partOfSpeech}
              onChange={(e) => setPartOfSpeech(e.target.value)}
              aria-label="품사"
              className="w-[6.75rem] shrink-0 px-2 text-sm"
            >
              <option value="">품사</option>
              {!knownPos && partOfSpeech && (
                <option value={partOfSpeech}>{partOfSpeech}</option>
              )}
              {PARTS_OF_SPEECH.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
            <Input
              ref={meaningRef}
              value={meaningDraft}
              onChange={(e) => setMeaningDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addMeaning();
                }
              }}
              placeholder="뜻 (예: 주저하다)"
              aria-label="뜻"
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0 px-3"
              onClick={addMeaning}
            >
              <Plus className="h-4 w-4" />
              추가
            </Button>
          </div>
          {meanings.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {meanings.map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs"
                >
                  {m}
                  <button
                    type="button"
                    aria-label={`${m} 삭제`}
                    className="rounded-full p-0.5 touch-manipulation hover:bg-muted"
                    onClick={() =>
                      setMeanings((prev) => prev.filter((x) => x !== m))
                    }
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <Input
            id="source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="출처"
            aria-label="출처"
            list="source-list"
          />
          <datalist id="source-list">
            {sources.map((s) => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>
          {sources.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {sources.slice(0, 8).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSource(s.name)}
                  className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs touch-manipulation hover:bg-muted"
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Input
            id="idiom-phrase"
            value={idiomPhrase}
            onChange={(e) => setIdiomPhrase(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addIdiom();
              }
            }}
            placeholder="숙어 (예: hesitate to do)"
            aria-label="숙어"
          />
          <div className="flex gap-2">
            <Input
              id="idiom-meaning"
              value={idiomMeaning}
              onChange={(e) => setIdiomMeaning(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addIdiom();
                }
              }}
              placeholder="숙어 뜻 (예: ~하기를 주저하다)"
              aria-label="숙어 뜻"
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0 px-3"
              onClick={addIdiom}
              aria-label="숙어 추가"
            >
              <Plus className="h-4 w-4" />
              추가
            </Button>
          </div>
          {idioms.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {idioms.map((item) => (
                <span
                  key={item.phrase}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs"
                >
                  <span className="font-medium">{item.phrase}</span>
                  <span className="text-muted-foreground">· {item.meaning}</span>
                  <button
                    type="button"
                    aria-label={`${item.phrase} 삭제`}
                    className="rounded-full p-0.5 touch-manipulation hover:bg-muted"
                    onClick={() =>
                      setIdioms((prev) =>
                        prev.filter((x) => x.phrase !== item.phrase)
                      )
                    }
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <Input
          id="memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (선택)"
          aria-label="메모"
        />

        {error && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "저장 중…" : "저장"}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="lg"
            className="w-full"
            disabled={busy}
            onClick={onDelete}
          >
            삭제
          </Button>
        </div>
      </form>
    </div>
  );
}
