"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, BookOpen, LogOut, Moon, Plus, Sun, Zap } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/words", label: "단어", icon: BookOpen },
  { href: "/words/new", label: "추가", icon: Plus },
  { href: "/review", label: "복습", icon: Zap },
  { href: "/stats", label: "통계", icon: BarChart2 },
];

function isNavActive(pathname: string, href: string): boolean {
  if (href === "/words/new") {
    return pathname === "/words/new";
  }
  if (href === "/words") {
    // list + detail, but not the add screen
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

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="phone-shell mx-auto flex min-h-[100dvh] w-full flex-col">
      <header className="safe-pad sticky top-0 z-20 flex items-center justify-between border-b border-border/60 bg-background/85 px-[var(--shell-pad-x)] pb-3 backdrop-blur-md">
        <Link
          href="/"
          className="flex min-w-0 items-baseline gap-2 touch-manipulation"
        >
          <p className="font-display text-[length:var(--title-sm)] font-semibold tracking-tight text-primary">
            WordCatch
          </p>
          {user && (
            <p className="truncate text-sm text-muted-foreground">{user.name}</p>
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
          <Button variant="ghost" size="icon" aria-label="로그아웃" onClick={logout}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 px-[var(--shell-pad-x)] py-[var(--shell-pad-y)] pb-[calc(5.5rem+var(--safe-bottom))]">
        {children}
      </main>

      <nav className="safe-pad fixed bottom-0 left-0 right-0 z-20 border-t border-border/60 bg-background/90 backdrop-blur-md">
        <div className="phone-shell mx-auto grid grid-cols-4 gap-1 px-2 py-2">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = isNavActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex min-h-[3rem] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 text-[0.7rem] font-medium touch-manipulation transition sm:text-xs",
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
    </div>
  );
}
