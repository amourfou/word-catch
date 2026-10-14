"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  clearUserSession,
  fetchMe,
  loginWithPin,
  logoutRequest,
  registerUser,
  saveUserSession,
} from "@/lib/auth";
import type { DbUser } from "@/lib/supabase";

interface AuthContextValue {
  user: DbUser | null;
  loading: boolean;
  login: (name: string, pin: string) => Promise<{ ok: boolean; message?: string; needsPin?: boolean; locked?: boolean }>;
  signupEnabled: boolean;
  register: (
    name: string,
    organization: string
  ) => Promise<{ ok: boolean; message?: string }>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PUBLIC_PATHS = ["/login"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const [signupEnabled, setSignupEnabled] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const me = await fetchMe();
      setSignupEnabled(me.signupEnabled);
      if (me.user) {
        saveUserSession(me.user);
        setUser(me.user);
      } else {
        clearUserSession();
        setUser(null);
      }
    } catch {
      setUser(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      clearUserSession();
      setUser(null);
    };
    window.addEventListener("wordcatch:unauthorized", onUnauthorized);
    return () => window.removeEventListener("wordcatch:unauthorized", onUnauthorized);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (loading) return;
    const isPublic = PUBLIC_PATHS.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`)
    );
    if (!user && !isPublic) {
      router.replace("/login");
    }
    if (user && pathname === "/login") {
      router.replace("/");
    }
  }, [user, loading, pathname, router]);

  const login = useCallback(async (name: string, pin: string) => {
    const r = await loginWithPin(name, pin);
    if (!r.user) {
      return { ok: false, message: r.error, needsPin: r.needsPin, locked: r.locked };
    }
    saveUserSession(r.user);
    setUser(r.user);
    return { ok: true };
  }, []);

  const register = useCallback(async (name: string, organization: string) => {
    const r = await registerUser(name, organization);
    return r.ok ? { ok: true, message: r.message } : { ok: false, message: r.error };
  }, []);

  const logout = useCallback(() => {
    void logoutRequest();
    clearUserSession();
    setUser(null);
    router.replace("/login");
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh, signupEnabled }),
    [user, loading, login, register, logout, refresh, signupEnabled]
  );

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  let body: ReactNode = children;
  if (loading) {
    body = (
      <div className="flex min-h-[100dvh] items-center justify-center text-muted-foreground">
        불러오는 중…
      </div>
    );
  } else if (!user && !isPublic) {
    body = (
      <div className="flex min-h-[100dvh] items-center justify-center text-muted-foreground">
        로그인 페이지로 이동 중…
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{body}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
