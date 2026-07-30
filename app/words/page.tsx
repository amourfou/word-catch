"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronDown, Info, SlidersHorizontal, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { DictionaryPopup } from "@/components/DictionaryPopup";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateKo } from "@/lib/date";
import { listSources, listWords, type DateFilter } from "@/lib/db";
import { STATUS_LABEL } from "@/lib/mastery";
import { wordMatchesSearch } from "@/lib/wordSearch";
import {
  DEFAULT_WORDS_FILTERS,
  loadWordsFilters,
  saveWordsFilters,
} from "@/lib/wordsFilters";
import type { SourceRow, WordRow, WordStatus } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const DATE_LABEL: Record<DateFilter, string> = {
  all: "전체 기간",
  today: "오늘",
  week: "이번 주",
  month: "이번 달",
};

const FILTERS_OPEN_KEY = "wordcatch-words-filters-open";
const SUGGEST_LIMIT = 8;
/** 영한 API 미정 — 당분간 영영 사전(참고용) 표시 */
const SHOW_DICTIONARY = true;

export default function WordsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const [filteredWords, setFilteredWords] = useState<WordRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [status, setStatus] = useState<WordStatus | "all">(
    DEFAULT_WORDS_FILTERS.status
  );
  const [source, setSource] = useState<string | "all">(
    DEFAULT_WORDS_FILTERS.source
  );
  const [date, setDate] = useState<DateFilter>(DEFAULT_WORDS_FILTERS.date);
  const [search, setSearch] = useState(DEFAULT_WORDS_FILTERS.search);
  const [filtersReady, setFiltersReady] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [dictWord, setDictWord] = useState<WordRow | null>(null);

  useEffect(() => {
    if (!user) return;
    const saved = loadWordsFilters(user.id);
    setStatus(saved.status);
    setSource(saved.source);
    setDate(saved.date);
    setSearch(saved.search);
    try {
      const open = localStorage.getItem(`${FILTERS_OPEN_KEY}:${user.id}`);
      setFiltersOpen(open === "1");
    } catch {
      /* ignore */
    }
    setFiltersReady(true);
  }, [user]);

  useEffect(() => {
    if (!user || !filtersReady) return;
    saveWordsFilters(user.id, { status, source, date, search });
  }, [user, filtersReady, status, source, date, search]);

  useEffect(() => {
    if (!user || !filtersReady) return;
    try {
      localStorage.setItem(
        `${FILTERS_OPEN_KEY}:${user.id}`,
        filtersOpen ? "1" : "0"
      );
    } catch {
      /* ignore */
    }
  }, [user, filtersReady, filtersOpen]);

  useEffect(() => {
    if (!user) return;
    void listSources(user.id).then(setSources);
  }, [user]);

  // Load by status / date / source only — search is client-side on this set
  useEffect(() => {
    if (!user || !filtersReady) return;
    void (async () => {
      setLoading(true);
      try {
        setFilteredWords(
          await listWords(user.id, { status, source, date, search: "" })
        );
      } finally {
        setLoading(false);
      }
    })();
  }, [user, filtersReady, status, source, date]);

  useEffect(() => {
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = searchWrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setSuggestOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, []);

  const words = useMemo(() => {
    if (!search.trim()) return filteredWords;
    return filteredWords.filter((w) =>
      wordMatchesSearch(w.word, w.meanings, search)
    );
  }, [filteredWords, search]);

  const suggestions = useMemo(() => {
    if (!search.trim()) return [];
    return words.slice(0, SUGGEST_LIMIT);
  }, [words, search]);

  const summaryChips = useMemo(() => {
    const chips: string[] = [];
    if (status === "all") chips.push("상태 전체");
    else chips.push(STATUS_LABEL[status]);
    chips.push(DATE_LABEL[date]);
    if (source === "all") chips.push("모든 출처");
    else chips.push(source);
    return chips;
  }, [status, date, source]);

  const hasCustomFilter =
    status !== "all" || date !== "all" || source !== "all";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="font-display text-2xl font-semibold">단어 목록</h1>
          <p className="text-sm text-muted-foreground tabular-nums">
            {loading || !filtersReady ? "…" : `${words.length}개`}
          </p>
        </div>
        <Link
          href="/words/new"
          className="shrink-0 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
        >
          + 추가
        </Link>
      </div>

      <div className="rounded-2xl border border-border bg-card">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="flex w-full items-center gap-2 px-3 py-3 text-left touch-manipulation"
          aria-expanded={filtersOpen}
          aria-label="필터 설정"
        >
          <SlidersHorizontal
            className={cn(
              "h-4 w-4 shrink-0",
              hasCustomFilter ? "text-primary" : "text-muted-foreground"
            )}
          />
          <div className="min-w-0 flex-1">
            {!filtersOpen ? (
              <div className="flex flex-wrap gap-1.5">
                {summaryChips.map((label) => (
                  <span
                    key={label}
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-medium",
                      hasCustomFilter
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-foreground">설정 변경</p>
            )}
          </div>
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
              filtersOpen && "rotate-180"
            )}
          />
        </button>

        {filtersOpen && (
          <div className="space-y-3 border-t border-border px-3 py-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                상태
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["all", "전체"],
                    ["unknown", "모름"],
                    ["learning", "아는 중"],
                    ["mastered", "외움"],
                  ] as const
                ).map(([v, label]) => (
                  <Chip
                    key={v}
                    active={status === v}
                    onClick={() => setStatus(v)}
                  >
                    {label}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                기간
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["all", "전체 기간"],
                    ["today", "오늘"],
                    ["week", "이번 주"],
                    ["month", "이번 달"],
                  ] as const
                ).map(([v, label]) => (
                  <Chip key={v} active={date === v} onClick={() => setDate(v)}>
                    {label}
                  </Chip>
                ))}
              </div>
            </div>

            {sources.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  출처
                </p>
                <div className="flex flex-wrap gap-2">
                  <Chip
                    active={source === "all"}
                    onClick={() => setSource("all")}
                  >
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
              </div>
            )}
          </div>
        )}
      </div>

      <div ref={searchWrapRef} className="relative">
        <div className="relative">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSuggestOpen(true);
            }}
            onFocus={() => setSuggestOpen(true)}
            placeholder="검색 (* 가능 · 한글=뜻)"
            aria-label="검색. 영문은 단어, 한글은 뜻. 별표로 패턴 검색"
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            className="pr-11"
          />
          <button
            type="button"
            className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground touch-manipulation hover:bg-muted hover:text-foreground"
            aria-label="검색 도움말"
            onClick={() => setHelpOpen(true)}
          >
            <Info className="h-5 w-5" />
          </button>
        </div>
        {suggestOpen && search.trim() && suggestions.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-auto rounded-xl border border-border bg-card py-1 shadow-lg">
            {suggestions.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left touch-manipulation hover:bg-muted"
                  onClick={() => {
                    setSearch(w.word);
                    setSuggestOpen(false);
                    router.push(`/words/${w.id}`);
                  }}
                >
                  <span className="min-w-0">
                    <span className="font-semibold">{w.word}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {w.meanings[0]}
                    </span>
                  </span>
                  <StatusBadge status={w.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {helpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="search-help-title"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h2
                id="search-help-title"
                className="font-display text-lg font-semibold"
              >
                검색 방법
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="닫기"
                onClick={() => setHelpOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              필터된 목록 안에서만 검색합니다.{" "}
              <span className="font-medium text-foreground">영문</span>은
              단어, <span className="font-medium text-foreground">한글</span>
              은 뜻으로 찾습니다.{" "}
              <span className="font-medium text-foreground">*</span> 로 위치를
              지정할 수 있어요.
            </p>
            <ul className="mt-3 space-y-2.5 text-sm">
              <li className="rounded-xl bg-muted/60 px-3 py-2.5">
                <p className="font-semibold">
                  <code className="text-primary">cat</code> ·{" "}
                  <code className="text-primary">*ing</code> ·{" "}
                  <code className="text-primary">*pp*</code>
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  영문: 시작 / 끝 / 포함 → 영어 단어
                </p>
              </li>
              <li className="rounded-xl bg-muted/60 px-3 py-2.5">
                <p className="font-semibold">
                  <code className="text-primary">망</code> ·{" "}
                  <code className="text-primary">*하다</code> ·{" "}
                  <code className="text-primary">*설*</code>
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  한글: 시작 / 끝 / 포함 → 뜻
                </p>
              </li>
            </ul>
            <Button
              type="button"
              className="mt-4 w-full"
              onClick={() => setHelpOpen(false)}
            >
              확인
            </Button>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {words.map((w) => (
          <li key={w.id}>
            <div className="rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40">
              <Link href={`/words/${w.id}`} className="block">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold">{w.word}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {w.meanings[0]}
                      {w.meanings.length > 1
                        ? ` 외 ${w.meanings.length - 1}`
                        : ""}
                    </p>
                  </div>
                  <StatusBadge status={w.status} />
                </div>
              </Link>
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Link
                  href={`/words/${w.id}`}
                  className="flex min-w-0 flex-1 flex-wrap gap-x-3 gap-y-1"
                >
                  {w.source && <span className="truncate">{w.source}</span>}
                  <span className="shrink-0">{formatDateKo(w.created_at)}</span>
                </Link>
                {SHOW_DICTIONARY && (
                  <button
                    type="button"
                    className="inline-flex shrink-0 items-center gap-1 font-medium text-primary touch-manipulation"
                    onClick={() => setDictWord(w)}
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    사전
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
        {!loading && filtersReady && words.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {filteredWords.length === 0
              ? "단어가 없어요. 먼저 추가해 보세요."
              : "검색 결과가 없어요."}
          </li>
        )}
      </ul>

      {SHOW_DICTIONARY && dictWord && (
        <DictionaryPopup
          word={dictWord.word}
          savedMeanings={dictWord.meanings}
          onClose={() => setDictWord(null)}
        />
      )}
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
