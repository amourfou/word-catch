"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { StatusBadge } from "@/components/ui/badge";
import {
  getDailyAccuracyTrend,
  getRecentAccuracy,
  getStatusCounts,
  getTopWrongWords,
  type DayAccuracy,
  type WrongWordStat,
} from "@/lib/db";
import { cn } from "@/lib/utils";

export default function StatsPage() {
  const { user } = useAuth();
  const [counts, setCounts] = useState({
    unknown: 0,
    learning: 0,
    mastered: 0,
    total: 0,
    today: 0,
  });
  const [accuracy, setAccuracy] = useState({ rate: 0, total: 0, correct: 0 });
  const [trend, setTrend] = useState<DayAccuracy[]>([]);
  const [wrongWords, setWrongWords] = useState<WrongWordStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setLoading(true);
      const [c, a, t, w] = await Promise.all([
        getStatusCounts(user.id),
        getRecentAccuracy(user.id, 50),
        getDailyAccuracyTrend(user.id, 7),
        getTopWrongWords(user.id, 8),
      ]);
      setCounts(c);
      setAccuracy(a);
      setTrend(t);
      setWrongWords(w);
      setLoading(false);
    })();
  }, [user]);

  const masteredRate =
    counts.total > 0 ? Math.round((counts.mastered / counts.total) * 100) : 0;
  const maxDayTotal = Math.max(1, ...trend.map((d) => d.total));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-[length:var(--title-lg)] font-semibold">
          통계
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          진척도와 최근 복습 추이
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3">
        <StatCard label="오늘 추가" value={loading ? "—" : String(counts.today)} />
        <StatCard label="전체 단어" value={loading ? "—" : String(counts.total)} />
        <StatCard
          label="최근 정답률"
          value={loading ? "—" : `${accuracy.rate}%`}
          hint={accuracy.total > 0 ? `최근 ${accuracy.total}회` : "복습 기록 없음"}
        />
        <StatCard
          label="외움 비율"
          value={loading ? "—" : `${masteredRate}%`}
          hint={`${counts.mastered} / ${counts.total}`}
        />
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-medium">숙달 상태</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-mastered transition-all"
            style={{ width: `${masteredRate}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <StatusCell status="unknown" count={counts.unknown} />
          <StatusCell status="learning" count={counts.learning} />
          <StatusCell status="mastered" count={counts.mastered} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-medium">최근 7일 정답률</p>
        <div className="mt-4 flex h-28 items-end gap-1.5">
          {trend.map((d) => {
            const height =
              d.total === 0 ? 8 : Math.max(12, Math.round((d.rate / 100) * 100));
            const day = d.date.slice(5).replace("-", "/");
            return (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[0.65rem] tabular-nums text-muted-foreground">
                  {d.total ? `${d.rate}` : "–"}
                </span>
                <div
                  className={cn(
                    "w-full max-w-[2rem] rounded-t-md transition-all",
                    d.total ? "bg-primary/80" : "bg-muted"
                  )}
                  style={{ height: `${height}%`, opacity: d.total ? 0.4 + (d.total / maxDayTotal) * 0.6 : 1 }}
                  title={`${d.date}: ${d.correct}/${d.total}`}
                />
                <span className="text-[0.65rem] text-muted-foreground">{day}</span>
              </div>
            );
          })}
        </div>
        {!loading && trend.every((d) => d.total === 0) && (
          <p className="mt-3 text-center text-xs text-muted-foreground">
            복습을 하면 여기에 추이가 쌓여요
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">자주 틀린 단어</p>
          <Link href="/review" className="text-xs font-medium text-primary">
            복습하기
          </Link>
        </div>
        {wrongWords.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {loading ? "불러오는 중…" : "아직 틀린 기록이 없어요"}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {wrongWords.map((w) => (
              <li key={w.wordId}>
                <Link
                  href={`/words/${w.wordId}`}
                  className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5 touch-manipulation hover:bg-muted"
                >
                  <span className="font-medium">{w.word}</span>
                  <span className="text-xs text-destructive tabular-nums">
                    오답 {w.wrongCount}회
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function StatusCell({
  status,
  count,
}: {
  status: "unknown" | "learning" | "mastered";
  count: number;
}) {
  return (
    <div className="rounded-xl bg-muted/40 px-2 py-2">
      <StatusBadge status={status} />
      <p className="mt-1.5 text-lg font-bold tabular-nums">{count}</p>
    </div>
  );
}
