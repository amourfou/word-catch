"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listSources, listWords } from "@/lib/db";
import {
  buildReviewItems,
  defaultReviewSettings,
  filterWordsByTargets,
  saveSession,
  type ReviewSettings,
  type ReviewTarget,
} from "@/lib/reviewEngine";
import {
  loadReviewPrefs,
  saveReviewPrefs,
} from "@/lib/reviewSettingsStorage";
import type { SourceRow } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export default function ReviewSetupPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<ReviewSettings>(defaultReviewSettings);
  const [customCount, setCustomCount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [prefsReady, setPrefsReady] = useState(false);
  const [sourcesPopupOpen, setSourcesPopupOpen] = useState(false);
  const [sourcesNeedExpand, setSourcesNeedExpand] = useState(false);
  const sourcesWrapRef = useRef<HTMLDivElement>(null);

  /** Selected sources first, then the rest (original order). */
  const orderedSources = useMemo(() => {
    const selected = new Set(settings.sources);
    const picked = sources.filter((s) => selected.has(s.name));
    const rest = sources.filter((s) => !selected.has(s.name));
    return [...picked, ...rest];
  }, [sources, settings.sources]);

  useEffect(() => {
    if (!user) return;
    const saved = loadReviewPrefs(user.id);
    setSettings({
      mode: saved.mode,
      direction: saved.direction,
      testFormat: saved.testFormat,
      targets: saved.targets,
      sources: saved.sources,
      count: saved.count,
    });
    const preset = [5, 10, 15, 20];
    setCustomCount(preset.includes(saved.count) ? "" : String(saved.count));
    void listSources(user.id).then((list) => {
      setSources(list);
      const known = new Set(list.map((x) => x.name));
      setSettings((s) => {
        const kept = s.sources.filter((name) => known.has(name));
        if (kept.length === 0 && list.length === 1) {
          return { ...s, sources: [list[0].name] };
        }
        return kept.length === s.sources.length ? s : { ...s, sources: kept };
      });
      setPrefsReady(true);
    });
  }, [user]);

  useLayoutEffect(() => {
    const el = sourcesWrapRef.current;
    if (!el || orderedSources.length === 0) {
      setSourcesNeedExpand(false);
      return;
    }
    setSourcesNeedExpand(el.scrollHeight > el.clientHeight + 1);
  }, [orderedSources, prefsReady, settings.sources]);

  const count =
    customCount.trim() !== ""
      ? Math.max(1, Math.min(100, Number(customCount) || 10))
      : settings.count;

  useEffect(() => {
    if (!user || !prefsReady) return;
    saveReviewPrefs(user.id, {
      mode: settings.mode,
      direction: settings.direction,
      testFormat: settings.testFormat,
      targets: settings.targets,
      sources: settings.sources,
      count,
    });
  }, [
    user,
    prefsReady,
    settings.mode,
    settings.direction,
    settings.testFormat,
    settings.targets,
    settings.sources,
    count,
  ]);

  const toggleTarget = (t: ReviewTarget) => {
    setSettings((s) => {
      if (t === "all") return { ...s, targets: ["all"], sources: [] };
      const withoutAll = s.targets.filter((x) => x !== "all");
      const has = withoutAll.includes(t);
      const next = has ? withoutAll.filter((x) => x !== t) : [...withoutAll, t];
      if (next.length === 0 && s.sources.length === 0) {
        return { ...s, targets: ["unknown"] };
      }
      return { ...s, targets: next };
    });
  };

  const toggleSource = (name: string) => {
    setSettings((s) => {
      const withoutAll = s.targets.filter((x) => x !== "all");
      const has = s.sources.includes(name);
      const nextSources = has
        ? s.sources.filter((x) => x !== name)
        : [...s.sources, name];
      if (withoutAll.length === 0 && nextSources.length === 0) {
        return { ...s, targets: ["unknown"], sources: [] };
      }
      return { ...s, targets: withoutAll, sources: nextSources };
    });
  };

  const start = async () => {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const all = await listWords(user.id);
      const filtered = filterWordsByTargets(
        all,
        settings.targets,
        settings.sources
      );
      if (filtered.length === 0) {
        setError("선택한 조건에 맞는 단어가 없어요.");
        setBusy(false);
        return;
      }
      const sessionSettings = { ...settings, count };
      // Build the full question set first, then enter the session.
      const items = buildReviewItems(filtered, sessionSettings, all);
      if (items.length === 0) {
        setError("문제를 만들 수 없어요.");
        setBusy(false);
        return;
      }
      saveSession({
        settings: sessionSettings,
        items,
        answers: [],
        startedAt: new Date().toISOString(),
      });
      router.push("/review/session");
    } catch {
      setError("복습을 시작할 수 없어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[length:var(--title-lg)] font-semibold">
          복습 설정
        </h1>
        <Button
          type="button"
          variant="accent"
          size="sm"
          className="shrink-0 px-4"
          disabled={busy}
          onClick={start}
        >
          {busy ? "준비 중…" : `${count}문제 시작`}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["test", "테스트"],
            ["flashcard", "플래시카드"],
          ] as const
        ).map(([v, label]) => (
          <SelectBtn
            key={v}
            active={settings.mode === v}
            onClick={() => setSettings((s) => ({ ...s, mode: v }))}
          >
            {label}
          </SelectBtn>
        ))}
      </div>

      {settings.mode === "test" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["mixed", "섞어서"],
                ["en_to_ko", "영→한"],
                ["ko_to_en", "한→영"],
                ["listen_to_ko", "듣기→한"],
              ] as const
            ).map(([v, label]) => (
              <SelectBtn
                key={v}
                active={settings.direction === v}
                onClick={() => setSettings((s) => ({ ...s, direction: v }))}
              >
                {label}
              </SelectBtn>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["multiple_choice", "객관식"],
                ["direct_input", "주관식"],
              ] as const
            ).map(([v, label]) => (
              <SelectBtn
                key={v}
                active={settings.testFormat === v}
                onClick={() => setSettings((s) => ({ ...s, testFormat: v }))}
              >
                {label}
              </SelectBtn>
            ))}
          </div>
        </>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["today", "오늘 추가"],
              ["week", "이번 주 추가"],
              ["month", "이번 달 추가"],
            ] as const
          ).map(([v, label]) => (
            <SelectBtn
              key={v}
              active={settings.targets.includes(v)}
              onClick={() => toggleTarget(v)}
              className="rounded-full px-3"
            >
              {label}
            </SelectBtn>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["unknown", "모름"],
              ["learning", "아는 중"],
              ["mastered", "외움"],
            ] as const
          ).map(([v, label]) => (
            <SelectBtn
              key={v}
              active={settings.targets.includes(v)}
              onClick={() => toggleTarget(v)}
              className="rounded-full px-3"
            >
              {label}
            </SelectBtn>
          ))}
        </div>
        {sources.length > 0 && (
          <div className="space-y-1.5">
            <div
              ref={sourcesWrapRef}
              className="flex max-h-[6.25rem] flex-wrap gap-2 overflow-hidden"
            >
              {orderedSources.map((s) => (
                <SelectBtn
                  key={s.id}
                  active={settings.sources.includes(s.name)}
                  onClick={() => toggleSource(s.name)}
                  className="rounded-full px-3"
                >
                  {s.name}
                </SelectBtn>
              ))}
            </div>
            {sourcesNeedExpand && (
              <button
                type="button"
                className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground touch-manipulation hover:text-foreground"
                onClick={() => setSourcesPopupOpen(true)}
              >
                더보기
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <SelectBtn
            active={settings.targets.includes("all")}
            onClick={() => toggleTarget("all")}
            className="rounded-full px-3"
          >
            전체 단어
          </SelectBtn>
        </div>
      </div>

      {sourcesPopupOpen && (
        <SourcesPickerPopup
          sources={orderedSources}
          selected={settings.sources}
          onToggle={toggleSource}
          onClose={() => setSourcesPopupOpen(false)}
        />
      )}

      <div className="flex items-stretch gap-2">
        <div className="grid flex-none grid-cols-4 gap-2">
          {[5, 10, 15, 20].map((n) => (
            <SelectBtn
              key={n}
              active={customCount === "" && settings.count === n}
              onClick={() => {
                setCustomCount("");
                setSettings((s) => ({ ...s, count: n }));
              }}
              className="min-w-[2.75rem] px-2"
            >
              {n}
            </SelectBtn>
          ))}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <Input
            id="custom"
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            value={customCount}
            onChange={(e) => {
              const v = e.target.value;
              setCustomCount(v);
              const n = Number(v);
              if (v.trim() && Number.isFinite(n) && n >= 1 && n <= 100) {
                setSettings((s) => ({ ...s, count: Math.round(n) }));
              }
            }}
            placeholder="직접"
            aria-label="문제 수 직접 입력"
            className={cn(
              "h-auto min-w-0 flex-1 py-2.5 text-center text-sm",
              customCount.trim() !== "" && "border-primary ring-2 ring-ring"
            )}
          />
          <span className="shrink-0 text-sm text-muted-foreground">문제</span>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function SourcesPickerPopup({
  sources,
  selected,
  onToggle,
  onClose,
}: {
  sources: SourceRow[];
  selected: string[];
  onToggle: (name: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sources-picker-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80dvh] w-full max-w-sm flex-col rounded-2xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2
            id="sources-picker-title"
            className="font-display text-lg font-semibold"
          >
            출처 선택
          </h2>
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
        <div className="overflow-y-auto px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {sources.map((s) => (
              <SelectBtn
                key={s.id}
                active={selected.includes(s.name)}
                onClick={() => onToggle(s.name)}
                className="rounded-full px-3"
              >
                {s.name}
              </SelectBtn>
            ))}
          </div>
        </div>
        <div className="border-t border-border px-4 py-3">
          <Button type="button" className="w-full" onClick={onClose}>
            확인
          </Button>
        </div>
      </div>
    </div>
  );
}

function SelectBtn({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-[var(--touch-min)] items-center justify-center rounded-xl border px-3 py-2.5 text-sm font-medium touch-manipulation transition",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-muted",
        className
      )}
    >
      {children}
    </button>
  );
}
