"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { StatusBadge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDateKo } from "@/lib/date";
import { listSources, listWords, type DateFilter, type WordFilters } from "@/lib/db";
import type { SourceRow, WordRow, WordStatus } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export default function WordsPage() {
  const { user } = useAuth();
  const [words, setWords] = useState<WordRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [status, setStatus] = useState<WordStatus | "all">("all");
  const [source, setSource] = useState<string | "all">("all");
  const [date, setDate] = useState<DateFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    void listSources(user.id).then(setSources);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => {
      void (async () => {
        setLoading(true);
        const filters: WordFilters = { status, source, date, search };
        try {
          setWords(await listWords(user.id, filters));
        } finally {
          setLoading(false);
        }
      })();
    }, 200);
    return () => clearTimeout(t);
  }, [user, status, source, date, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-semibold">단어 목록</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? "불러오는 중…" : `${words.length}개`}
          </p>
        </div>
        <Link
          href="/words/new"
          className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
        >
          + 추가
        </Link>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="단어 또는 뜻 검색"
      />

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "전체"],
            ["unknown", "모름"],
            ["learning", "아는 중"],
            ["mastered", "외움"],
          ] as const
        ).map(([v, label]) => (
          <Chip key={v} active={status === v} onClick={() => setStatus(v)}>
            {label}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "전체 기간"],
            ["today", "오늘"],
            ["week", "이번 주"],
          ] as const
        ).map(([v, label]) => (
          <Chip key={v} active={date === v} onClick={() => setDate(v)}>
            {label}
          </Chip>
        ))}
      </div>

      {sources.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Chip active={source === "all"} onClick={() => setSource("all")}>
            모든 출처
          </Chip>
          {sources.map((s) => (
            <Chip
              key={s.id}
              active={source === s.name}
              onClick={() => setSource(s.name)}
            >
              {s.name}
            </Chip>
          ))}
        </div>
      )}

      <ul className="space-y-2">
        {words.map((w) => (
          <li key={w.id}>
            <Link
              href={`/words/${w.id}`}
              className="block rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold">{w.word}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {w.meanings[0]}
                    {w.meanings.length > 1 ? ` 외 ${w.meanings.length - 1}` : ""}
                  </p>
                </div>
                <StatusBadge status={w.status} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {w.source && <span>{w.source}</span>}
                <span>{formatDateKo(w.created_at)}</span>
              </div>
            </Link>
          </li>
        ))}
        {!loading && words.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            단어가 없어요. 먼저 추가해 보세요.
          </li>
        )}
      </ul>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-medium touch-manipulation transition",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
      )}
    >
      {children}
    </button>
  );
}
