"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteWord, getWord, listSources, updateWord } from "@/lib/db";
import type { SourceRow, WordRow } from "@/lib/supabase";

export default function WordDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const id = String(params.id);
  const router = useRouter();
  const [wordRow, setWordRow] = useState<WordRow | null>(null);
  const [word, setWord] = useState("");
  const [meanings, setMeanings] = useState([""]);
  const [source, setSource] = useState("");
  const [partOfSpeech, setPartOfSpeech] = useState("");
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
      setMeanings(row.meanings.length ? row.meanings : [""]);
      setSource(row.source ?? "");
      setPartOfSpeech(row.part_of_speech ?? "");
      setMemo(row.memo ?? "");
      setLoading(false);
    })();
  }, [user, id]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const updated = await updateWord(user.id, id, {
        word,
        meanings,
        source,
        part_of_speech: partOfSpeech,
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">단어 수정</h1>
        <StatusBadge status={wordRow.status} />
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="word">영어 단어</Label>
          <Input
            id="word"
            value={word}
            onChange={(e) => setWord(e.target.value)}
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
                  required={i === 0}
                />
                {meanings.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
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
            list="source-list"
          />
          <datalist id="source-list">
            {sources.map((s) => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>
        </div>

        <div>
          <Label htmlFor="pos">품사</Label>
          <Input
            id="pos"
            value={partOfSpeech}
            onChange={(e) => setPartOfSpeech(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="memo">메모</Label>
          <Textarea
            id="memo"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>

        {error && (
          <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

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
      </form>
    </div>
  );
}
