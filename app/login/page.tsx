"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";

export default function LoginPage() {
  const { login, register, user } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) {
    router.replace("/");
    return null;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const result =
      mode === "login" ? await login(name) : await register(name, organization);
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? "실패했어요");
      return;
    }
    router.replace("/");
  };

  return (
    <div className="safe-pad phone-shell mx-auto flex min-h-[100dvh] w-full flex-col justify-center px-[var(--shell-pad-x)]">
      <div className="rounded-3xl border border-border bg-card/80 p-5 shadow-sm backdrop-blur-sm sm:p-6">
        <p className="text-center font-display text-[length:var(--title-lg)] font-semibold text-primary">
          WordCatch
        </p>
        <h1 className="mt-2 text-center text-xl font-bold">
          {mode === "login" ? "로그인" : "등록"}
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {mode === "login"
            ? "이름으로 로그인하세요"
            : "이름과 소속을 입력해 계정을 만들어요"}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
          {(["login", "register"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError("");
              }}
              className={cn(
                "rounded-xl py-2.5 text-sm font-semibold touch-manipulation transition",
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-background/60"
              )}
            >
              {m === "login" ? "로그인" : "등록"}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          {mode === "register" && (
            <div>
              <Label htmlFor="organization">소속</Label>
              <Input
                id="organization"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                maxLength={15}
                autoComplete="organization"
                placeholder="예: 가족, 학교…"
                required
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">
                {organization.length}/15
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="name">이름</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={10}
              autoComplete="username"
              placeholder={mode === "login" ? "이름 입력" : "사용할 이름"}
              required
            />
            {mode === "register" && (
              <p className="mt-1 text-right text-xs text-muted-foreground">
                {name.length}/10
              </p>
            )}
          </div>

          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={
              busy || !name.trim() || (mode === "register" && !organization.trim())
            }
          >
            {busy
              ? mode === "login"
                ? "확인 중…"
                : "등록 중…"
              : mode === "login"
                ? "로그인"
                : "등록하고 시작"}
          </Button>
        </form>
      </div>
    </div>
  );
}
