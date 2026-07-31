"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Volume2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { playWordAudio } from "@/lib/audio";
import { recordReviewResult } from "@/lib/db";
import {
  clearSession,
  gradeAnswer,
  loadSession,
  saveResult,
  saveSession,
  type ReviewSessionState,
  type SessionAnswer,
} from "@/lib/reviewEngine";
import { cn } from "@/lib/utils";

function ListenPrompt({
  phonetic,
  word,
  audioUrl,
}: {
  phonetic: string;
  word: string;
  audioUrl: string | null;
}) {
  useEffect(() => {
    playWordAudio({ audioUrl, word });
  }, [phonetic, word, audioUrl]);

  return (
    <button
      type="button"
      className="mt-3 w-full rounded-2xl bg-muted/40 px-4 py-5 text-center touch-manipulation transition hover:bg-muted/70 active:scale-[0.99]"
      onClick={() => playWordAudio({ audioUrl, word })}
      aria-label="발음 다시 듣기"
    >
      <p className="font-display text-3xl font-semibold tracking-wide">
        {phonetic || "🔊"}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">탭하여 다시 듣기</p>
    </button>
  );
}

function directionLabel(direction: string): string {
  if (direction === "listen_to_ko") return "듣기 → 한";
  if (direction === "en_to_ko") return "영 → 한";
  return "한 → 영";
}

export default function ReviewSessionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [session, setSession] = useState<ReviewSessionState | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = loadSession();
    if (!s || s.items.length === 0) {
      router.replace("/review");
      return;
    }
    setSession(s);
    setIndex(s.answers.length);
  }, [router]);

  if (!session || !user) {
    return <p className="text-muted-foreground">불러오는 중…</p>;
  }

  if (index >= session.items.length) {
    saveResult(session);
    clearSession();
    router.replace("/review/result");
    return <p className="text-muted-foreground">결과로 이동 중…</p>;
  }

  const item = session.items[index];
  const progress = `${index + 1} / ${session.items.length}`;

  const goBack = () => {
    if (busy) return;
    const answered = session.answers.length;
    const ok =
      answered === 0 ||
      confirm(
        `지금까지 ${answered}문제 푼 기록이 있어요. 설정 화면으로 돌아갈까요?`
      );
    if (!ok) return;
    clearSession();
    router.push("/review");
  };

  const finishAnswer = async (
    isCorrect: boolean,
    userAnswer: string
  ) => {
    if (busy) return;
    setBusy(true);
    setFeedback(isCorrect ? "correct" : "wrong");

    await recordReviewResult({
      userId: user.id,
      word: item.word,
      isCorrect,
      mode: session.settings.mode,
      testType: item.testType,
      direction: item.direction,
      userAnswer,
    });

    const entry: SessionAnswer = {
      wordId: item.word.id,
      word: item.word.word,
      isCorrect,
      userAnswer,
      correctAnswer: item.correctAnswer,
      mode: session.settings.mode,
      testType: item.testType,
      direction: item.direction,
    };

    const nextSession: ReviewSessionState = {
      ...session,
      answers: [...session.answers, entry],
    };
    setSession(nextSession);
    saveSession(nextSession);

    setTimeout(() => {
      setFlipped(false);
      setAnswer("");
      setFeedback(null);
      setBusy(false);
      const nextIndex = index + 1;
      if (nextIndex >= nextSession.items.length) {
        saveResult(nextSession);
        clearSession();
        router.replace("/review/result");
      } else {
        setIndex(nextIndex);
      }
    }, 700);
  };

  // Flashcard
  if (session.settings.mode === "flashcard") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 gap-0.5 px-2 text-muted-foreground"
            disabled={busy}
            onClick={goBack}
          >
            <ChevronLeft className="h-4 w-4" />
            이전
          </Button>
          <p className="text-sm text-muted-foreground">{progress}</p>
        </div>
        <div className="flex min-h-[240px] flex-col items-center justify-center rounded-3xl border border-border bg-card p-6 text-center">
          <p className="font-display text-3xl font-semibold">{item.word.word}</p>
          {item.word.phonetic && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <p className="font-display text-3xl font-semibold tracking-wide text-muted-foreground">
                {item.word.phonetic}
              </p>
              <button
                type="button"
                className="inline-flex shrink-0 items-center justify-center rounded-xl p-2 text-muted-foreground touch-manipulation transition hover:bg-muted hover:text-foreground active:scale-[0.98]"
                onClick={() =>
                  playWordAudio({
                    audioUrl: item.word.audio_url,
                    word: item.word.word,
                  })
                }
                aria-label="발음 듣기"
              >
                <Volume2 className="h-6 w-6" />
              </button>
            </div>
          )}
          {flipped && (
            <div className="mt-6 space-y-2 animate-in fade-in">
              <p className="text-lg font-medium">
                {item.word.meanings.join(" · ")}
              </p>
              {item.word.idioms?.length > 0 && (
                <div className="space-y-1 text-sm text-muted-foreground">
                  {item.word.idioms.map((idiom) => (
                    <p key={idiom.phrase}>
                      <span className="font-medium text-foreground">
                        {idiom.phrase}
                      </span>
                      {" · "}
                      {idiom.meaning}
                    </p>
                  ))}
                </div>
              )}
              {item.word.source && (
                <p className="text-sm text-muted-foreground">출처: {item.word.source}</p>
              )}
              {item.word.memo && (
                <p className="text-sm text-muted-foreground">{item.word.memo}</p>
              )}
            </div>
          )}
        </div>

        {!flipped ? (
          <Button size="lg" className="w-full" onClick={() => setFlipped(true)}>
            뜻 보기
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button
              size="lg"
              variant="destructive"
              disabled={busy}
              onClick={() => finishAnswer(false, "모름")}
            >
              모름
            </Button>
            <Button
              size="lg"
              variant="accent"
              disabled={busy}
              onClick={() => finishAnswer(true, "알고 있음")}
            >
              알고 있음
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Test
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 gap-0.5 px-2 text-muted-foreground"
          disabled={busy}
          onClick={goBack}
        >
          <ChevronLeft className="h-4 w-4" />
          이전
        </Button>
        <p className="text-sm text-muted-foreground">{progress}</p>
      </div>
      <div className="rounded-3xl border border-border bg-card p-6">
        <p className="text-xs font-medium text-muted-foreground">
          {directionLabel(item.direction)}
          {item.testType === "multiple_choice" ? " · 객관식" : " · 주관식"}
        </p>
        {item.direction === "listen_to_ko" ? (
          <ListenPrompt
            phonetic={item.prompt}
            word={item.word.word}
            audioUrl={item.word.audio_url}
          />
        ) : (
          <p className="mt-3 font-display text-2xl font-semibold">{item.prompt}</p>
        )}
      </div>

      {item.testType === "multiple_choice" && item.choices ? (
        <div className="grid gap-2">
          {item.choices.map((c) => (
            <Button
              key={c}
              size="lg"
              variant="outline"
              disabled={busy}
              className={cn(
                "w-full justify-start text-left",
                feedback &&
                  (c === item.correctAnswer
                    ? "border-mastered bg-mastered/10"
                    : answer === c
                      ? "border-destructive bg-destructive/10"
                      : "")
              )}
              onClick={() => {
                setAnswer(c);
                void finishAnswer(
                  gradeAnswer(item.direction, item.word, c) ||
                    c === item.correctAnswer,
                  c
                );
              }}
            >
              {c}
            </Button>
          ))}
        </div>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const ok = gradeAnswer(item.direction, item.word, answer);
            void finishAnswer(ok, answer);
          }}
        >
          <Input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="답을 입력하세요"
            autoFocus
            disabled={busy}
            autoCapitalize="off"
            autoCorrect="off"
          />
          <Button type="submit" size="lg" className="w-full" disabled={busy || !answer.trim()}>
            제출
          </Button>
        </form>
      )}

      {feedback && (
        <p
          className={cn(
            "rounded-xl px-3 py-2 text-center text-sm font-medium",
            feedback === "correct"
              ? "bg-mastered/15 text-mastered"
              : "bg-destructive/10 text-destructive"
          )}
        >
          {feedback === "correct"
            ? "정답!"
            : `오답 · 정답: ${item.word.meanings.join(", ")} / ${item.word.word}`}
        </p>
      )}
    </div>
  );
}
