"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export const NAVER_DICT_URL = "https://en.dict.naver.com/";

interface PersistentDictPanelProps {
  active: boolean;
}

/** Single mounted instance — toggles visibility so the Naver iframe survives tab switches. */
export function PersistentDictPanel({ active }: PersistentDictPanelProps) {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (!active) return;
    const t = window.setTimeout(() => setShowFallback(true), 2500);
    return () => window.clearTimeout(t);
  }, [active]);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col bg-background",
        active
          ? "relative flex-1"
          : // Keep mounted but out of hit-testing / layout (avoids scroll capture)
            "pointer-events-none fixed bottom-0 right-0 h-px w-px overflow-hidden opacity-0"
      )}
      aria-hidden={!active}
      inert={!active ? true : undefined}
    >
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border/60 px-3 py-2">
        <p className="text-xs leading-snug text-muted-foreground">
          여기서 찾고, <span className="text-foreground">추가</span> 탭에서 직접
          적어요
        </p>
        <a
          href={NAVER_DICT_URL}
          target="_blank"
          rel="noopener noreferrer"
          tabIndex={active ? 0 : -1}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-border bg-background px-2 text-xs font-semibold touch-manipulation hover:bg-muted"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          열기
        </a>
      </div>

      <div className="relative min-h-0 flex-1 bg-muted/30">
        <iframe
          title="네이버 영어사전"
          src={NAVER_DICT_URL}
          className={cn(
            "absolute inset-0 h-full w-full border-0 bg-background",
            !active && "pointer-events-none"
          )}
          tabIndex={active ? 0 : -1}
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        />

        {showFallback && active && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3">
            <div className="pointer-events-auto flex max-w-sm items-center gap-2 rounded-xl border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                화면이 비면 네이버가 차단한 거예요.
              </p>
              <a
                href={NAVER_DICT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-7 shrink-0 items-center rounded-lg bg-primary px-2 text-xs font-semibold text-primary-foreground touch-manipulation hover:bg-primary/90"
              >
                네이버 사전 열기
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
