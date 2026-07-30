"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

  useEffect(() => {
    if (!user) return;
    void listSources(user.id).then((list) => {
      setSources(list);
      if (list.length === 1) {
        setSettings((s) =>
          s.sources.length === 0 ? { ...s, sources: [list[0].name] } : s
        );
      }
    });
  }, [user]);

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

  const count =
    customCount.trim() !== ""
      ? Math.max(1, Math.min(100, Number(customCount) || 10))
      : settings.count;

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
      const items = buildReviewItems(
        filtered,
        { ...settings, count },
        all
      );
      saveSession({
        settings: { ...settings, count },
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
      <h1 className="font-display text-[length:var(--title-lg)] font-semibold">
        복습 설정
      </h1>

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
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["mixed", "섞어서"],
              ["en_to_ko", "영→한"],
              ["ko_to_en", "한→영"],
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
              ["all", "전체"],
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
          <div className="flex flex-wrap gap-2">
            {sources.map((s) => (
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
        )}
      </div>

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
            onChange={(e) => setCustomCount(e.target.value)}
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

      <Button size="lg" className="w-full" disabled={busy} onClick={start}>
        {busy ? "준비 중…" : `${count}문제 시작`}
      </Button>
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
