"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookPlus, Zap } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getRecentAccuracy, getStatusCounts } from "@/lib/db";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const { user } = useAuth();
  const [counts, setCounts] = useState({
    unknown: 0,
    learning: 0,
    mastered: 0,
    total: 0,
    today: 0,
  });
  const [accuracy, setAccuracy] = useState({ rate: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      setLoading(true);
      const [c, a] = await Promise.all([
        getStatusCounts(user.id),
        getRecentAccuracy(user.id, 50),
      ]);
      setCounts(c);
      setAccuracy(a);
      setLoading(false);
    })();
  }, [user]);

  const masteredRate =
    counts.total > 0 ? Math.round((counts.mastered / counts.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <section>
        <h1 className="font-display text-[length:var(--title-lg)] font-semibold tracking-tight">
          안녕하세요, {user?.name}님
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          모르는 단어를 잡고, 복습으로 붙잡아요
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">오늘 추가</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">
            {loading ? "—" : counts.today}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">전체 단어</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">
            {loading ? "—" : counts.total}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">진척도</p>
          <p className="text-sm text-muted-foreground">외움 {masteredRate}%</p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-mastered transition-all"
            style={{ width: `${masteredRate}%` }}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <StatusBadge status="unknown" />
          <span className="text-sm tabular-nums">{counts.unknown}</span>
          <StatusBadge status="learning" />
          <span className="text-sm tabular-nums">{counts.learning}</span>
          <StatusBadge status="mastered" />
          <span className="text-sm tabular-nums">{counts.mastered}</span>
        </div>
        {accuracy.total > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            최근 복습 정답률 {accuracy.rate}% ({accuracy.total}회)
          </p>
        )}
      </section>

      <section className="grid gap-3">
        <Link
          href="/words/new"
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          <BookPlus className="h-5 w-5" />
          단어 추가하기
        </Link>
        <Link
          href="/review"
          className={cn(buttonVariants({ size: "lg", variant: "accent" }), "w-full")}
        >
          <Zap className="h-5 w-5" />
          복습 시작하기
        </Link>
        <Link
          href="/words"
          className={cn(buttonVariants({ size: "lg", variant: "outline" }), "w-full")}
        >
          단어 목록 보기
        </Link>
      </section>
    </div>
  );
}
