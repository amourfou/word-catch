"use client";

import { useState, type Ref } from "react";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { playWordAudio } from "@/lib/audio";
import { fetchDictionaryEntry } from "@/lib/dictionary";
import { cn } from "@/lib/utils";

interface WordVerifyFieldProps {
  word: string;
  onWordChange: (word: string) => void;
  phonetic: string;
  onPhoneticChange: (phonetic: string) => void;
  audioUrl: string;
  onAudioUrlChange: (audioUrl: string) => void;
  /** Fires when dictionary verification succeeds/fails/clears. */
  onVerifiedChange?: (verified: boolean) => void;
  inputRef?: Ref<HTMLInputElement>;
  required?: boolean;
  placeholder?: string;
}

export function WordVerifyField({
  word,
  onWordChange,
  phonetic,
  onPhoneticChange,
  audioUrl,
  onAudioUrlChange,
  onVerifiedChange,
  inputRef,
  required,
  placeholder = "영어 단어",
}: WordVerifyFieldProps) {
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<{
    kind: "ok" | "ok-inexact" | "missing" | "error";
    text: string;
  } | null>(null);

  const clearPronunciation = () => {
    onPhoneticChange("");
    onAudioUrlChange("");
    setNote(null);
    onVerifiedChange?.(false);
  };

  const verify = async () => {
    const w = word.trim();
    if (!w) {
      setNote({ kind: "error", text: "단어를 먼저 입력하세요." });
      onVerifiedChange?.(false);
      return;
    }
    setChecking(true);
    setNote(null);
    const result = await fetchDictionaryEntry(w);
    setChecking(false);
    if (!result.ok) {
      onPhoneticChange("");
      onAudioUrlChange("");
      onVerifiedChange?.(false);
      setNote({ kind: "missing", text: result.message });
      return;
    }

    // Exact headword: keep pronunciation + cache (server-side).
    if (result.exact) {
      const ph = result.entry.phonetic?.trim() || "";
      const audio = result.entry.audio?.trim() || "";
      onPhoneticChange(ph);
      onAudioUrlChange(audio);
      onVerifiedChange?.(true);
      setNote({
        kind: "ok",
        text: ph
          ? `확인됨 · ${ph}${audio ? " · 오디오" : ""}`
          : audio
            ? "확인됨 · 오디오만 있음"
            : "사전에 있는 단어예요 (발음 정보 없음)",
      });
      if (audio || w) {
        playWordAudio({ audioUrl: audio || null, word: w });
      }
      return;
    }

    // Related stem only (e.g. intensively → intensive): verified, no audio.
    onPhoneticChange("");
    onAudioUrlChange("");
    onVerifiedChange?.(true);
    setNote({
      kind: "ok-inexact",
      text: result.suggested
        ? `확인됨 · 표제어 일치 없음 (유사: ${result.suggested}) · 발음 없음`
        : "확인됨 · 표제어 일치 없음 · 발음 없음",
    });
  };

  return (
    <div>
      <div className="flex gap-2">
        <Input
          id="word"
          ref={inputRef}
          value={word}
          onChange={(e) => {
            onWordChange(e.target.value);
            if (phonetic || audioUrl || note) {
              clearPronunciation();
            } else {
              onVerifiedChange?.(false);
            }
          }}
          placeholder={placeholder}
          aria-label="영어 단어"
          autoCapitalize="off"
          autoCorrect="off"
          required={required}
          className="min-w-0 flex-1"
        />
        <Button
          type="button"
          variant="outline"
          className="shrink-0 px-3"
          disabled={checking || !word.trim()}
          onClick={() => void verify()}
        >
          {checking ? "확인 중…" : "검증"}
        </Button>
      </div>
      {note?.kind === "ok" || phonetic || audioUrl ? (
        <div className="mt-1.5 flex items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2">
          <div className="min-w-0 flex flex-1 items-center gap-1.5 text-sm">
            <span className="text-muted-foreground">발음 </span>
            <span className="font-medium tabular-nums">
              {phonetic || "(발음 정보 없음)"}
            </span>
            {(audioUrl || word.trim()) && (
              <button
                type="button"
                className="inline-flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground touch-manipulation hover:bg-muted hover:text-foreground"
                onClick={() =>
                  playWordAudio({ audioUrl: audioUrl || null, word })
                }
                aria-label="발음 듣기"
              >
                <Volume2 className="h-4 w-4" />
              </button>
            )}
            <span className="text-xs text-mastered">확인됨</span>
          </div>
          <button
            type="button"
            className="shrink-0 text-xs text-muted-foreground touch-manipulation hover:text-foreground"
            onClick={clearPronunciation}
          >
            지우기
          </button>
        </div>
      ) : note?.kind === "ok-inexact" ? (
        <p className="mt-1.5 text-xs text-mastered">{note.text}</p>
      ) : note ? (
        <p
          className={cn(
            "mt-1.5 text-xs",
            note.kind === "missing" || note.kind === "error"
              ? "text-destructive"
              : "text-muted-foreground"
          )}
        >
          {note.text}
        </p>
      ) : null}
    </div>
  );
}
