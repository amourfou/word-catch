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

  return (
    <div className="space-y-5">
      <h1 className="font-display text-[length:var(--title-lg)] font-semibold">
        통계
      </h1>

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
        <div className="mt-3">
          {trend.length > 0 ? (
            <AccuracyLineChart trend={trend} />
          ) : (
            <div className="h-28" />
          )}
        </div>
        {!loading && trend.every((d) => d.total === 0) && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
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
                  className="flex items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2.5 touch-manipulation hover:bg-muted"
                >
                  <div className="min-w-0 flex flex-1 items-center gap-2">
                    <span className="truncate font-medium">{w.word}</span>
                    <StatusBadge status={w.status} />
                  </div>
                  <span className="shrink-0 text-xs text-destructive tabular-nums">
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

function AccuracyLineChart({ trend }: { trend: DayAccuracy[] }) {
  const W = 320;
  const H = 112;
  const padL = 8;
  const padR = 8;
  const padT = 18;
  const padB = 22;
  const n = Math.max(trend.length, 1);
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const pts = trend.map((d, i) => {
    const x = padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y =
      d.total === 0 ? null : padT + (1 - d.rate / 100) * innerH;
    return { x, y, d };
  });

  const segments: string[] = [];
  let buf: string[] = [];
  for (const p of pts) {
    if (p.y == null) {
      if (buf.length) {
        segments.push(buf.join(" "));
        buf = [];
      }
      continue;
    }
    buf.push(`${p.x},${p.y}`);
  }
  if (buf.length) segments.push(buf.join(" "));

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-28 w-full overflow-visible"
        role="img"
        aria-label="최근 7일 정답률 선 그래프"
      >
        {/* guide lines */}
        {[0, 50, 100].map((rate) => {
          const y = padT + (1 - rate / 100) * innerH;
          return (
            <line
              key={rate}
              x1={padL}
              x2={W - padR}
              y1={y}
              y2={y}
              stroke="hsl(var(--border))"
              strokeWidth={1}
              strokeDasharray={rate === 0 || rate === 100 ? undefined : "3 3"}
            />
          );
        })}
        {segments.map((points, i) => (
          <polyline
            key={i}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />
        ))}
        {pts.map((p) =>
          p.y == null ? (
            <circle
              key={p.d.date}
              cx={p.x}
              cy={padT + innerH}
              r={2.5}
              fill="hsl(var(--muted-foreground) / 0.35)"
            />
          ) : (
            <g key={p.d.date}>
              <title>{`${p.d.date}: ${p.d.correct}/${p.d.total} (${p.d.rate}%)`}</title>
              <circle
                cx={p.x}
                cy={p.y}
                r={4}
                fill="hsl(var(--primary))"
                stroke="hsl(var(--card))"
                strokeWidth={2}
              />
              <text
                x={p.x}
                y={p.y - 8}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: 9 }}
              >
                {p.d.rate}
              </text>
            </g>
          )
        )}
        {pts.map((p) => (
          <text
            key={`lbl-${p.d.date}`}
            x={p.x}
            y={H - 4}
            textAnchor="middle"
            className="fill-muted-foreground"
            style={{ fontSize: 9 }}
          >
            {p.d.date.slice(5).replace("-", "/")}
          </text>
        ))}
      </svg>
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
