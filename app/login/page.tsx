"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { PinPad } from "@/components/PinPad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLastName } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";
type Step = "name" | "pin";

export default function LoginPage() {
  const { login, register, user, signupEnabled } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [organization, setOrganization] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    const last = getLastName();
    if (last) setName(last);
  }, []);

  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);
  if (user) return null;

  const submitPin = async (value: string) => {
    setError("");
    setBusy(true);
    const r = await login(name, value);
    setBusy(false);
    if (r.ok) {
      router.replace("/");
      return;
    }
    setPin("");
    setShake(true);
    setTimeout(() => setShake(false), 400);
    setError(r.message ?? "로그인하지 못했어요.");
    if (r.needsPin) setStep("name");
  };

  const onNameNext = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) return;
    setPin("");
    setStep("pin");
  };

  const onRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    const r = await register(name, organization);
    setBusy(false);
    if (!r.ok) {
      setError(r.message ?? "등록하지 못했어요.");
      return;
    }
    setInfo(r.message ?? "등록했어요. 관리자에게 PIN을 받아 로그인해 주세요.");
    setMode("login");
  };

  return (
    <div className="safe-pad phone-shell mx-auto flex min-h-[100dvh] w-full flex-col justify-center px-[var(--shell-pad-x)]">
      <div className="rounded-3xl border border-border bg-card/80 p-5 shadow-sm backdrop-blur-sm sm:p-6">
        <p className="text-center font-display text-[length:var(--title-lg)] font-semibold text-primary">
          WordCatch
        </p>

        {signupEnabled && (
          <div className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
            {(["login", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setStep("name");
                  setError("");
                }}
                className={cn(
                  "rounded-xl py-2.5 text-sm font-semibold touch-manipulation transition",
                  mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-background/60"
                )}
              >
                {m === "login" ? "로그인" : "등록"}
              </button>
            ))}
          </div>
        )}

        {info && <p className="mt-4 rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">{info}</p>}

        {mode === "login" && step === "name" && (
          <form onSubmit={onNameNext} className="mt-5 space-y-4">
            <h1 className="text-center text-xl font-bold">반가워요! 이름이 뭐예요?</h1>
            <div>
              <Label htmlFor="name">이름</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={10}
                autoComplete="username"
                autoCapitalize="off"
                placeholder="이름 입력"
                className="h-12 text-lg"
                required
              />
            </div>
            {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={!name.trim()}>
              다음
            </Button>
          </form>
        )}

        {mode === "login" && step === "pin" && (
          <div className="mt-5">
            <button
              type="button"
              onClick={() => {
                setStep("name");
                setError("");
                setPin("");
              }}
              className="text-sm text-muted-foreground underline-offset-2 hover:underline"
            >
              ← {name} (이름 바꾸기)
            </button>
            <div className="mt-4">
              <PinPad value={pin} onChange={setPin} onComplete={submitPin} disabled={busy} shake={shake} />
            </div>
            <p className="mt-3 min-h-[1.5rem] text-center text-sm" aria-live="polite">
              {busy ? (
                <span className="text-muted-foreground">확인 중…</span>
              ) : error ? (
                <span className="text-destructive">{error}</span>
              ) : null}
            </p>
            <p className="mt-1 text-center text-xs text-muted-foreground">PIN을 잊었으면 관리자(부모님)에게 다시 만들어 달라고 해요.</p>
          </div>
        )}

        {mode === "register" && signupEnabled && (
          <form onSubmit={onRegister} className="mt-5 space-y-4">
            <div>
              <Label htmlFor="organization">소속</Label>
              <Input id="organization" value={organization} onChange={(e) => setOrganization(e.target.value)} maxLength={15} required />
            </div>
            <div>
              <Label htmlFor="rname">이름</Label>
              <Input id="rname" value={name} onChange={(e) => setName(e.target.value)} maxLength={10} required />
            </div>
            {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={busy || !name.trim() || !organization.trim()}>
              {busy ? "등록 중…" : "등록하기"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
