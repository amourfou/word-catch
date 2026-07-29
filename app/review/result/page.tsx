"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getStatusCounts } from "@/lib/db";
import {
  buildReviewItems,
  loadResult,
  saveSession,
  type ReviewSessionState,
} from "@/lib/reviewEngine";
import { listWords } from "@/lib/db";
import { cn } from "@/lib/utils";

export default function ReviewResultPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [result, setResult] = useState<ReviewSessionState | null>(null);
  const [counts, setCounts] = useState({
    unknown: 0,
    learning: 0,
    mastered: 0,
    total: 0,
  });

  useEffect(() => {
    const r = loadResult();
    if (!r) {
      router.replace("/review");
      return;
    }
    setResult(r);
  }, [router]);

  useEffect(() => {
    if (!user) return;
    void getStatusCounts(user.id).then((c) =>
      setCounts({
        unknown: c.unknown,
        learning: c.learning,
        mastered: c.mastered,
        total: c.total,
      })
    );
  }, [user]);

  if (!result) {
    return <p className="text-muted-foreground">불러오는 중…</p>;
  }

  const correct = result.answers.filter((a) => a.isCorrect).length;
  const total = result.answers.length;
  const rate = total ? Math.round((correct / total) * 100) : 0;
  const wrong = result.answers.filter((a) => !a.isCorrect);
  const masteredRate =
    counts.total > 0 ? Math.round((counts.mastered / counts.total) * 100) : 0;

  const encourage =
    rate >= 80
      ? "잘했어요! 이 페이스면 금방 외울 수 있어요."
      : rate >= 50
        ? "좋아요. 틀린 것만 다시 보면 더 단단해져요."
        : "괜찮아요. 틀린 단어를 한 번 더 잡아봐요!";

  const retryWrong = async () => {
    if (!user || wrong.length === 0) return;
    const all = await listWords(user.id);
    const wrongWords = all.filter((w) => wrong.some((a) => a.wordId === w.id));
    if (wrongWords.length === 0) return;
    const settings = {
      ...result.settings,
      count: wrongWords.length,
      targets: ["all" as const],
    };
    const items = buildReviewItems(wrongWords, settings, all);
    saveSession({
      settings,
      items,
      answers: [],
      startedAt: new Date().toISOString(),
    });
    router.push("/review/session");
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">복습 결과</h1>
        <p className="mt-1 text-sm text-muted-foreground">{encourage}</p>
      </div>

      <section className="grid grid-cols-3 gap-3">
        <Stat label="정답" value={String(correct)} />
        <Stat label="오답" value={String(wrong.length)} />
        <Stat label="정답률" value={`${rate}%`} />
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-medium">전체 진척도</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-mastered"
            style={{ width: `${masteredRate}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge status="unknown" />
          <span className="tabular-nums">{counts.unknown}</span>
          <StatusBadge status="learning" />
          <span className="tabular-nums">{counts.learning}</span>
          <StatusBadge status="mastered" />
          <span className="tabular-nums">{counts.mastered}</span>
          <span className="text-muted-foreground">({masteredRate}%)</span>
        </div>
      </section>

      {wrong.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">틀린 단어</h2>
          <ul className="space-y-2">
            {wrong.map((a) => (
              <li
                key={`${a.wordId}-${a.userAnswer}`}
                className="rounded-xl border border-border bg-card px-4 py-3"
              >
                <p className="font-semibold">{a.word}</p>
                <p className="text-sm text-muted-foreground">
                  내 답: {a.userAnswer || "(없음)"} · 정답: {a.correctAnswer}
                </p>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => void retryWrong()}
            className={cn(buttonVariants({ size: "lg", variant: "accent" }), "mt-3 w-full")}
          >
            틀린 것만 다시 복습
          </button>
        </section>
      )}

      <div className="grid gap-2">
        <Link
          href="/review"
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          새 복습
        </Link>
        <Link
          href="/"
          className={cn(buttonVariants({ size: "lg", variant: "outline" }), "w-full")}
        >
          홈으로
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
