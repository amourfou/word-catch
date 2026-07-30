"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createWord, listSources } from "@/lib/db";
import { PARTS_OF_SPEECH } from "@/lib/pos";
import type { SourceRow } from "@/lib/supabase";

export default function NewWordPage() {
  const { user } = useAuth();
  const router = useRouter();
  const wordRef = useRef<HTMLInputElement>(null);
  const meaningRef = useRef<HTMLInputElement>(null);
  const [word, setWord] = useState("");
  const [meaningDraft, setMeaningDraft] = useState("");
  const [meanings, setMeanings] = useState<string[]>([]);
  const [source, setSource] = useState("");
  const [partOfSpeech, setPartOfSpeech] = useState("");
  const [memo, setMemo] = useState("");
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadSources = async () => {
    if (!user) return;
    setSources(await listSources(user.id));
  };

  useEffect(() => {
    void loadSources();
    wordRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const resetForm = () => {
    setWord("");
    setMeaningDraft("");
    setMeanings([]);
    setPartOfSpeech("");
    setMemo("");
    setError("");
    wordRef.current?.focus();
  };

  const addMeaning = () => {
    const trimmed = meaningDraft.trim();
    if (!trimmed) return;
    if (meanings.some((m) => m === trimmed)) {
      setMeaningDraft("");
      return;
    }
    setMeanings((prev) => [...prev, trimmed]);
    setMeaningDraft("");
    meaningRef.current?.focus();
  };

  const collectMeanings = () => {
    const draft = meaningDraft.trim();
    const list = [...meanings];
    if (draft && !list.includes(draft)) list.push(draft);
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
    setMessage("");
    try {
      await createWord(user.id, {
        word,
        meanings: finalMeanings,
        source,
        part_of_speech: partOfSpeech,
        memo,
      });
      setMessage(`「${word.trim()}」 저장했어요. 다음 단어를 입력하세요.`);
      resetForm();
      void loadSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h1 className="font-display text-[length:var(--title-lg)] font-semibold">
          단어 추가
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          스펠링·뜻을 직접 입력 (자동완성 없음)
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-2.5">
        <Input
          id="word"
          ref={wordRef}
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="영어 단어 (예: hesitate)"
          aria-label="영어 단어"
          autoCapitalize="off"
          autoCorrect="off"
          required
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
              placeholder="뜻 (문맥에 맞게)"
              aria-label="뜻"
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0 px-3"
              onClick={addMeaning}
              aria-label="뜻 추가"
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
            placeholder="출처 (예: 학원 교재 Unit 3)"
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
        {message && (
          <p className="rounded-xl bg-mastered/10 px-3 py-2 text-sm text-mastered">
            {message}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button type="submit" size="lg" disabled={busy} className="w-full">
            {busy ? "저장 중…" : "저장하고 계속"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            onClick={() => router.push("/")}
          >
            완료
          </Button>
        </div>
      </form>
    </div>
  );
}
