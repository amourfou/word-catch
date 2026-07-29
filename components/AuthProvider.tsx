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
  getStoredSession,
  getStoredUserId,
  getUserById,
  loginByName,
  registerUser,
  saveUserSession,
} from "@/lib/auth";
import type { DbUser } from "@/lib/supabase";

interface AuthContextValue {
  user: DbUser | null;
  loading: boolean;
  login: (name: string) => Promise<{ ok: boolean; message?: string }>;
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

  const refresh = useCallback(async () => {
    const id = getStoredUserId();
    if (!id) {
      setUser(null);
      setLoading(false);
      return;
    }

    const cached = getStoredSession();
    if (cached?.id && cached.name) {
      setUser({
        id: cached.id,
        name: cached.name,
        organization: cached.organization,
        high_score: 0,
        created_at: "",
        updated_at: "",
      });
    }

    const u = await getUserById(id);
    if (!u) {
      clearUserSession();
      setUser(null);
    } else {
      saveUserSession(u);
      setUser(u);
    }
    setLoading(false);
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

  const login = useCallback(async (name: string) => {
    const u = await loginByName(name);
    if (!u) {
      return {
        ok: false,
        message: "이름을 찾을 수 없어요. 등록 후 이용해 주세요.",
      };
    }
    saveUserSession(u);
    setUser(u);
    return { ok: true };
  }, []);

  const register = useCallback(async (name: string, organization: string) => {
    const { user: u, error } = await registerUser(name, organization);
    if (!u) {
      return { ok: false, message: error ?? "등록 실패" };
    }
    saveUserSession(u);
    setUser(u);
    return { ok: true };
  }, []);

  const logout = useCallback(() => {
    clearUserSession();
    setUser(null);
    router.replace("/login");
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh]
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
