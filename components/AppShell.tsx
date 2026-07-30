"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart2,
  BookOpen,
  LogOut,
  Moon,
  Plus,
  Search,
  Sun,
  Zap,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/components/AuthProvider";
import { PersistentDictPanel } from "@/components/PersistentDictPanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/words", label: "단어", icon: BookOpen },
  { href: "/words/new", label: "추가", icon: Plus },
  { href: "/review", label: "복습", icon: Zap },
  { href: "/stats", label: "통계", icon: BarChart2 },
  { href: "/dict", label: "사전", icon: Search },
];

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/words/new") {
    return pathname === "/words/new";
  }
  if (href === "/words") {
    return (
      pathname === "/words" ||
      (pathname.startsWith("/words/") && pathname !== "/words/new")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const isDict = pathname === "/dict" || pathname.startsWith("/dict/");
  const [dictMounted, setDictMounted] = useState(false);

  useEffect(() => {
    if (isDict) setDictMounted(true);
  }, [isDict]);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <>
      {/*
        Full-viewport scroll root — PC wheel works even on side margins.
        Scrollbar is hidden via scrollbar-none.
      */}
      <div
        className={cn(
          "h-[100dvh] w-full overflow-x-hidden scrollbar-none",
          isDict ? "flex flex-col overflow-hidden" : "overflow-y-auto"
        )}
      >
        <div
          className={cn(
            "phone-shell mx-auto flex w-full flex-col",
            isDict ? "h-full min-h-0 overflow-hidden" : "min-h-full"
          )}
        >
          <header className="safe-pad sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-border/60 bg-background/85 px-[var(--shell-pad-x)] pb-3 backdrop-blur-md">
            <Link
              href="/"
              className="flex min-w-0 items-baseline gap-2 touch-manipulation"
            >
              <p className="font-display text-[length:var(--title-sm)] font-semibold tracking-tight text-primary">
                WordCatch
              </p>
              {user && (
                <p className="truncate text-sm text-muted-foreground">
                  {user.name}
                </p>
              )}
            </Link>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="테마 전환"
                className="relative"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="로그아웃"
                onClick={logout}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </header>

          <main
            className={cn(
              "relative flex-1",
              isDict
                ? "flex min-h-0 flex-col overflow-hidden px-0 py-0"
                : // py는 pb를 덮어쓰므로 pt/pb를 분리 (하단 네비 여백 확보 → 스크롤 가능)
                  "px-[var(--shell-pad-x)] pt-[var(--shell-pad-y)] pb-[calc(7rem+var(--safe-bottom))]"
            )}
          >
            {!isDict && children}
            {dictMounted && <PersistentDictPanel active={isDict} />}
          </main>
        </div>
      </div>

      <nav className="safe-pad fixed bottom-0 left-0 right-0 z-20 border-t border-border/60 bg-background/90 backdrop-blur-md">
        <div className="phone-shell mx-auto grid grid-cols-5 gap-0.5 px-1 py-2 sm:gap-1 sm:px-2">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = isNavActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-h-[3rem] flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-2 text-[0.65rem] font-medium touch-manipulation transition sm:px-1 sm:text-xs",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
