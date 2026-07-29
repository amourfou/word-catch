"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createWord, listSources } from "@/lib/db";
import type { SourceRow } from "@/lib/supabase";

export default function NewWordPage() {
  const { user } = useAuth();
  const router = useRouter();
  const wordRef = useRef<HTMLInputElement>(null);
  const [word, setWord] = useState("");
  const [meanings, setMeanings] = useState([""]);
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
    setMeanings([""]);
    setPartOfSpeech("");
    setMemo("");
    // keep source for continuous entry convenience
    setError("");
    wordRef.current?.focus();
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await createWord(user.id, {
        word,
        meanings,
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
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">단어 추가</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          스펠링과 문맥 뜻을 직접 입력하세요 (자동완성 없음)
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="word">영어 단어</Label>
          <Input
            id="word"
            ref={wordRef}
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder="예: hesitate"
            autoCapitalize="off"
            autoCorrect="off"
            required
          />
        </div>

        <div>
          <Label>뜻</Label>
          <div className="space-y-2">
            {meanings.map((m, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={m}
                  onChange={(e) => {
                    const next = [...meanings];
                    next[i] = e.target.value;
                    setMeanings(next);
                  }}
                  placeholder={`뜻 ${i + 1}`}
                  required={i === 0}
                />
                {meanings.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="뜻 삭제"
                    onClick={() => setMeanings(meanings.filter((_, j) => j !== i))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => setMeanings([...meanings, ""])}
          >
            <Plus className="h-4 w-4" />
            뜻 추가
          </Button>
        </div>

        <div>
          <Label htmlFor="source">출처</Label>
          <Input
            id="source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="예: 학원 교재 Unit 3"
            list="source-list"
          />
          <datalist id="source-list">
            {sources.map((s) => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>
          {sources.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {sources.slice(0, 8).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSource(s.name)}
                  className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs touch-manipulation hover:bg-muted"
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="pos">품사 (선택)</Label>
          <Input
            id="pos"
            value={partOfSpeech}
            onChange={(e) => setPartOfSpeech(e.target.value)}
            placeholder="예: v., n."
          />
        </div>

        <div>
          <Label htmlFor="memo">메모 (선택)</Label>
          <Textarea
            id="memo"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="문장이나 팁"
          />
        </div>

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

        <div className="grid gap-2 pt-2">
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
