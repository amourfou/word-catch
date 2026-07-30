"use client";

import { useEffect, useState } from "react";
import { BookOpen, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchDictionaryEntry,
  type DictionaryEntry,
} from "@/lib/dictionary";

interface DictionaryPopupProps {
  word: string;
  savedMeanings?: string[];
  onClose: () => void;
}

export function DictionaryPopup({
  word,
  savedMeanings,
  onClose,
}: DictionaryPopupProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      setEntry(null);
      const result = await fetchDictionaryEntry(word);
      if (cancelled) return;
      if (!result.ok) {
        setError(result.message);
      } else {
        setEntry(result.entry);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [word]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const playAudio = () => {
    if (!entry?.audio) return;
    const src = entry.audio.startsWith("//")
      ? `https:${entry.audio}`
      : entry.audio;
    void new Audio(src).play().catch(() => undefined);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dict-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80dvh] w-full max-w-sm flex-col rounded-2xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2
              id="dict-title"
              className="font-display text-xl font-semibold truncate"
            >
              {word}
            </h2>
            {entry?.phonetic && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {entry.phonetic}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {entry?.audio && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="발음 듣기"
                onClick={playAudio}
              >
                <Volume2 className="h-5 w-5" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="닫기"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="overflow-y-auto px-4 py-3 pb-4">
          {savedMeanings && savedMeanings.length > 0 && (
            <div className="mb-3 rounded-xl bg-primary/5 px-3 py-2.5">
              <p className="text-xs font-medium text-primary">내가 적은 뜻</p>
              <p className="mt-0.5 text-sm">{savedMeanings.join(" · ")}</p>
            </div>
          )}

          {loading && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              사전 불러오는 중…
            </p>
          )}
          {!loading && error && (
            <div className="py-6 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            </div>
          )}
          {!loading && entry && (
            <div className="space-y-4">
              {entry.meanings.map((m) => (
                <section key={m.partOfSpeech}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                    {m.partOfSpeech}
                  </p>
                  <ol className="mt-1.5 list-decimal space-y-2 pl-4 text-sm">
                    {m.definitions.map((d, i) => (
                      <li key={`${m.partOfSpeech}-${i}`}>
                        <p>{d.definition}</p>
                        {d.example && (
                          <p className="mt-0.5 text-muted-foreground">
                            e.g. {d.example}
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
              <p className="pt-1 text-center text-[10px] text-muted-foreground">
                From Merriam-Webster&apos;s Learner&apos;s Dictionary
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
