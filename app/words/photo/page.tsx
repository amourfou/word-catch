"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resizeToJpeg } from "@/lib/client/resize";
import { createWord, listSources, listWords } from "@/lib/db";
import { itemsToSave, markDuplicates, splitMeanings, wordKey, type ReviewItem } from "@/lib/photoWords";
import { formatMeaningEntry } from "@/lib/pos";
import type { SourceRow } from "@/lib/supabase";

type Phase = "pick" | "reading" | "review" | "saving" | "done";

export default function PhotoWordsPage() {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [preview, setPreview] = useState<string | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [existing, setExisting] = useState<string[]>([]);
  const [source, setSource] = useState("");
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ saved: string[]; failed: { word: string; error: string }[] } | null>(null);

  useEffect(() => {
    if (!user) return;
    void listSources(user.id).then(setSources).catch(() => undefined);
  }, [user]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const onPick = async (file: File | undefined) => {
    if (!file || !user) return;
    setError("");
    setPhase("reading");
    try {
      // 폰에서 줄이고 EXIF 제거 → 서버는 메모리에서만 읽고 버림(저장 안 함)
      const blob = await resizeToJpeg(file);
      setPreview(URL.createObjectURL(blob));
      const fd = new FormData();
      fd.append("photo", blob, "photo.jpg");
      const res = await fetch("/api/words/photo", { method: "POST", body: fd, credentials: "same-origin" });
      const data = (await res.json().catch(() => ({}))) as { items?: ReviewItem[]; error?: string };
      if (!res.ok) throw new Error(data.error || `읽기 실패 (${res.status})`);
      const mine = (await listWords(user.id, {})).map((w) => w.word);
      setExisting(mine);
      const got = markDuplicates(data.items ?? [], mine);
      if (got.length === 0) throw new Error("사진에서 단어를 찾지 못했어요. 더 밝고 반듯하게 찍어 볼래요?");
      setItems(got);
      setPhase("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "사진을 읽지 못했어요.");
      setPhase("pick");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const update = (key: string, patch: Partial<ReviewItem>) =>
    setItems((prev) => {
      const next = prev.map((it) => (it.key === key ? { ...it, ...patch } : it));
      // 단어를 고치면 중복 표시를 다시 계산(체크 상태는 사용자가 정한 대로 유지)
      if (patch.word === undefined) return next;
      const marked = markDuplicates(next, existing);
      return next.map((it, i) => ({ ...it, duplicate: marked[i].duplicate, repeatedInPhoto: marked[i].repeatedInPhoto }));
    });

  const toSave = useMemo(() => itemsToSave(items, existing), [items, existing]);

  const onSave = async () => {
    if (!user || toSave.length === 0) return;
    setPhase("saving");
    const saved: string[] = [];
    const failed: { word: string; error: string }[] = [];
    for (const it of toSave) {
      try {
        // 기존 단어 추가와 같은 경로(createWord): 새 단어 insert만, 중복이면 서버가 거절
        await createWord(user.id, {
          word: it.word,
          meanings: it.meanings.map((m) => formatMeaningEntry(it.part_of_speech, m)).filter(Boolean),
          part_of_speech: it.part_of_speech || undefined,
          phonetic: it.phonetic || undefined,
          source: source.trim() || undefined,
          memo: it.example || undefined,
        });
        saved.push(it.word);
      } catch (e) {
        failed.push({ word: it.word, error: e instanceof Error ? e.message : "저장 실패" });
      }
    }
    setResult({ saved, failed });
    setPhase("done");
  };

  const reset = () => {
    setItems([]);
    setResult(null);
    setPreview(null);
    setPhase("pick");
  };

  const dupCount = items.filter((i) => i.duplicate).length;

  return (
    <div className="space-y-3 pb-44">
      <div>
        <h1 className="font-display text-[length:var(--title-lg)] font-semibold">사진으로 단어 추가</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          단어장 사진을 찍으면 단어와 뜻을 뽑아 줘요. 확인하고 저장을 눌러야 등록돼요. 사진은 저장하지 않아요.
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onPick(e.target.files?.[0])}
      />

      {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      {(phase === "pick" || phase === "reading") && (
        <div className="space-y-2">
          <Button type="button" className="w-full" disabled={phase === "reading"} onClick={() => fileRef.current?.click()}>
            <Camera className="mr-1.5 h-4 w-4" />
            {phase === "reading" ? "사진 읽는 중… (10~30초)" : "사진 찍기 / 고르기"}
          </Button>
          <Link href="/words/new" className="block text-center text-xs text-muted-foreground underline">
            직접 입력하기
          </Link>
        </div>
      )}

      {(phase === "review" || phase === "saving") && (
        <>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="찍은 사진" className="max-h-40 w-full rounded-xl border border-border object-contain" />
          )}
          <div className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
            {items.length}개 찾음{dupCount > 0 && ` · 이미 있는 단어 ${dupCount}개는 체크 해제했어요`}
          </div>
          <div>
            <Input
              list="photo-sources"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="출처 (선택, 예: 능률 3과)"
              aria-label="출처"
            />
            <datalist id="photo-sources">
              {sources.map((s) => <option key={s.id} value={s.name} />)}
            </datalist>
          </div>
          <ul className="space-y-2">
            {items.map((it) => (
              <li
                key={it.key}
                className={`rounded-2xl border px-3 py-2 ${it.checked ? "border-primary/40 bg-card" : "border-border bg-muted/40 opacity-75"}`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0 accent-primary"
                    checked={it.checked}
                    onChange={(e) => update(it.key, { checked: e.target.checked })}
                    aria-label={`${it.word} 저장`}
                  />
                  <Input
                    value={it.word}
                    onChange={(e) => update(it.key, { word: e.target.value })}
                    className="h-9 font-semibold"
                    aria-label="단어"
                  />
                  <button
                    type="button"
                    className="shrink-0 p-1 text-muted-foreground"
                    onClick={() => setItems((p) => p.filter((x) => x.key !== it.key))}
                    aria-label="행 삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-1.5 flex items-center gap-2 pl-7">
                  {it.part_of_speech && (
                    <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px]">{it.part_of_speech}</span>
                  )}
                  <Input
                    value={it.meanings.join(", ")}
                    onChange={(e) => update(it.key, { meanings: splitMeanings(e.target.value).length ? [e.target.value] : [] })}
                    onBlur={(e) => update(it.key, { meanings: splitMeanings(e.target.value) })}
                    className="h-9"
                    aria-label="뜻 (쉼표로 구분)"
                    placeholder="뜻 (쉼표로 구분)"
                  />
                </div>
                {(it.duplicate || it.repeatedInPhoto || it.phonetic || it.example) && (
                  <div className="mt-1 space-y-0.5 pl-7 text-[11px]">
                    {it.duplicate && <p className="font-semibold text-amber-600">이미 내 단어장에 있어요 (저장 안 함)</p>}
                    {it.repeatedInPhoto && <p className="font-semibold text-amber-600">사진 안에서 반복된 단어예요</p>}
                    {it.phonetic && <p className="text-muted-foreground">{it.phonetic}</p>}
                    {it.example && <p className="text-muted-foreground">예문: {it.example}</p>}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-lg gap-2 bg-background/95 px-4 py-2">
            <Button type="button" variant="outline" onClick={reset} disabled={phase === "saving"}>다시 찍기</Button>
            <Button type="button" className="flex-1" disabled={toSave.length === 0 || phase === "saving"} onClick={() => void onSave()}>
              {phase === "saving" ? "저장 중…" : `${toSave.length}개 저장`}
            </Button>
          </div>
        </>
      )}

      {phase === "done" && result && (
        <div className="space-y-2 rounded-2xl border border-border bg-card p-3 text-sm">
          <p className="font-semibold">{result.saved.length}개 저장했어요.</p>
          {result.failed.length > 0 && (
            <ul className="text-xs text-destructive">
              {result.failed.map((f) => <li key={wordKey(f.word)}>{f.word}: {f.error}</li>)}
            </ul>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={reset}>한 장 더</Button>
            <Link href="/words" className="flex-1"><Button type="button" className="w-full">단어장 보기</Button></Link>
          </div>
        </div>
      )}
    </div>
  );
}
