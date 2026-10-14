"use client";

import { useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

export const PIN_LENGTH = 6;

/**
 * Big 3×4 number pad for a 6-digit PIN. Phone-first (64px keys), also accepts a
 * physical keyboard. Calls onComplete when all 6 digits are entered.
 */
export function PinPad({
  value,
  onChange,
  onComplete,
  disabled,
  shake,
  label = "PIN 6자리",
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  shake?: boolean;
  label?: string;
}) {
  const press = useCallback(
    (d: string) => {
      if (disabled || value.length >= PIN_LENGTH) return;
      const next = value + d;
      onChange(next);
      if (next.length === PIN_LENGTH) onComplete?.(next);
    },
    [disabled, value, onChange, onComplete]
  );
  const back = useCallback(() => {
    if (!disabled) onChange(value.slice(0, -1));
  }, [disabled, value, onChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [press, back]);

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];

  return (
    <div>
      <p className="text-center text-sm font-medium text-muted-foreground">{label}</p>
      <div
        className={cn("mt-3 flex justify-center gap-3", shake && "animate-[pin-shake_0.35s_ease-in-out]")}
        aria-label={`${value.length}/${PIN_LENGTH}자리 입력됨`}
        role="status"
      >
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-4 w-4 rounded-full border-2 transition",
              i < value.length ? "border-primary bg-primary" : "border-muted-foreground/40"
            )}
          />
        ))}
      </div>
      <div className="mx-auto mt-5 grid max-w-[18rem] grid-cols-3 gap-3">
        {keys.map((k) => {
          if (k === "clear") {
            return (
              <button
                key={k}
                type="button"
                onClick={() => !disabled && onChange("")}
                disabled={disabled || !value}
                className="h-16 rounded-2xl text-sm font-semibold text-muted-foreground touch-manipulation active:bg-muted disabled:opacity-40"
              >
                전체 지움
              </button>
            );
          }
          if (k === "back") {
            return (
              <button
                key={k}
                type="button"
                onClick={back}
                disabled={disabled || !value}
                aria-label="한 자리 지우기"
                className="h-16 rounded-2xl text-2xl text-muted-foreground touch-manipulation active:bg-muted disabled:opacity-40"
              >
                ⌫
              </button>
            );
          }
          return (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              disabled={disabled}
              className="h-16 rounded-2xl border border-border bg-background text-2xl font-semibold shadow-sm touch-manipulation transition active:scale-95 active:bg-primary/10 disabled:opacity-50"
            >
              {k}
            </button>
          );
        })}
      </div>
    </div>
  );
}
