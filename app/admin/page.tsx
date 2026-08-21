"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { adminFetch } from "@/lib/adminApi";
import { formatHourKst } from "@/lib/date";
import { isAdminUser, type WordRow, type WordStatus } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Tab = "users" | "words" | "stats" | "push" | "system";

type AdminUser = {
  id: string;
  name: string;
  organization: string;
  is_admin: boolean;
  created_at: string;
  wordCount: number;
};

const TABS: { id: Tab; label: string }[] = [
  { id: "users", label: "사용자" },
  { id: "words", label: "단어" },
  { id: "stats", label: "통계" },
  { id: "push", label: "푸시" },
  { id: "system", label: "시스템" },
];

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("users");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdminUser(user)) {
      router.replace("/");
    }
  }, [user, loading, router]);

  if (loading || !user || !isAdminUser(user)) {
    return (
      <p className="text-sm text-muted-foreground">관리자 확인 중…</p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-[length:var(--title-lg)] font-semibold">
          관리
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {user.name} · WordCatch 관리자
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setMessage(null);
            }}
            className={cn(
              "rounded-xl px-3 py-2 text-xs font-semibold touch-manipulation",
              tab === t.id
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {message && (
        <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
          {message}
        </p>
      )}

      {tab === "users" && (
        <UsersPanel adminUserId={user.id} onMessage={setMessage} />
      )}
      {tab === "words" && (
        <WordsPanel adminUserId={user.id} onMessage={setMessage} />
      )}
      {tab === "stats" && <StatsPanel adminUserId={user.id} />}
      {tab === "push" && (
        <PushPanel adminUserId={user.id} onMessage={setMessage} />
      )}
      {tab === "system" && (
        <SystemPanel adminUserId={user.id} onMessage={setMessage} />
      )}
    </div>
  );
}

function UsersPanel({
  adminUserId,
  onMessage,
}: {
  adminUserId: string;
  onMessage: (m: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const res = await adminFetch<{ users: AdminUser[] }>(
      `/api/admin/users?q=${encodeURIComponent(q)}`,
      adminUserId
    );
    setBusy(false);
    if (!res.ok) {
      onMessage(res.error);
      return;
    }
    setUsers(res.data.users);
  }, [adminUserId, q, onMessage]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleAdmin = async (u: AdminUser) => {
    const next = !u.is_admin;
    if (
      !next &&
      !confirm(`${u.name} 님의 관리자 권한을 해제할까요?`)
    ) {
      return;
    }
    setBusy(true);
    const res = await adminFetch<{ user: AdminUser }>(
      "/api/admin/users",
      adminUserId,
      { method: "PATCH", json: { userId: u.id, is_admin: next } }
    );
    setBusy(false);
    if (!res.ok) {
      onMessage(res.error);
      return;
    }
    onMessage(
      next
        ? `${u.name} 님을 관리자로 지정했어요.`
        : `${u.name} 님 관리자 권한을 해제했어요.`
    );
    void load();
  };

  return (
    <section className="space-y-3">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이름 검색"
          className="h-10 flex-1 rounded-xl border border-border bg-background px-3 text-sm"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void load()}
          className="rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          검색
        </button>
      </div>
      <ul className="space-y-2">
        {users.map((u) => (
          <li
            key={u.id}
            className="rounded-2xl border border-border bg-card px-3 py-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">
                  {u.name}
                  {u.is_admin && (
                    <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
                      관리자
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {u.organization || "소속 없음"} · 단어 {u.wordCount}개
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void toggleAdmin(u)}
                className="shrink-0 rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold"
              >
                {u.is_admin ? "권한 해제" : "관리자 지정"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function WordsPanel({
  adminUserId,
  onMessage,
}: {
  adminUserId: string;
  onMessage: (m: string | null) => void;
}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userId, setUserId] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [idiomsOnly, setIdiomsOnly] = useState(false);
  const [words, setWords] = useState<WordRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await adminFetch<{ users: AdminUser[] }>(
        "/api/admin/users",
        adminUserId
      );
      if (res.ok) {
        setUsers(res.data.users);
        if (!userId && res.data.users[0]) setUserId(res.data.users[0].id);
      }
    })();
  }, [adminUserId, userId]);

  const load = useCallback(async () => {
    if (!userId) return;
    setBusy(true);
    const params = new URLSearchParams({
      userId,
      q,
      status,
      idiomsOnly: idiomsOnly ? "1" : "0",
    });
    const res = await adminFetch<{ words: WordRow[] }>(
      `/api/admin/words?${params}`,
      adminUserId
    );
    setBusy(false);
    if (!res.ok) {
      onMessage(res.error);
      return;
    }
    setWords(res.data.words);
  }, [adminUserId, userId, q, status, idiomsOnly, onMessage]);

  useEffect(() => {
    if (userId) void load();
  }, [userId, load]);

  const remove = async (w: WordRow) => {
    if (!confirm(`「${w.word}」를 삭제할까요?`)) return;
    setBusy(true);
    const res = await adminFetch("/api/admin/words", adminUserId, {
      method: "DELETE",
      json: { wordId: w.id, userId: w.user_id },
    });
    setBusy(false);
    if (!res.ok) {
      onMessage(res.error);
      return;
    }
    onMessage(`「${w.word}」 삭제했어요.`);
    void load();
  };

  const setWordStatus = async (w: WordRow, next: WordStatus) => {
    setBusy(true);
    const res = await adminFetch("/api/admin/words", adminUserId, {
      method: "PATCH",
      json: { wordId: w.id, userId: w.user_id, status: next },
    });
    setBusy(false);
    if (!res.ok) {
      onMessage(res.error);
      return;
    }
    void load();
  };

  return (
    <section className="space-y-3">
      <select
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} ({u.wordCount})
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="단어 검색"
          className="h-10 min-w-[8rem] flex-1 rounded-xl border border-border bg-background px-3 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-10 rounded-xl border border-border bg-background px-2 text-sm"
        >
          <option value="all">전체 상태</option>
          <option value="unknown">모름</option>
          <option value="learning">아는 중</option>
          <option value="mastered">외움</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={idiomsOnly}
            onChange={(e) => setIdiomsOnly(e.target.checked)}
          />
          숙어 있음
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void load()}
          className="rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground"
        >
          새로고침
        </button>
      </div>
      <ul className="space-y-2">
        {words.map((w) => (
          <li
            key={w.id}
            className="rounded-2xl border border-border bg-card px-3 py-3 text-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">{w.word}</p>
                <p className="text-xs text-muted-foreground">
                  {(w.meanings ?? []).join(" · ") || "(뜻 없음)"}
                </p>
                {Array.isArray(w.idioms) && w.idioms.length > 0 && (
                  <p className="mt-1 text-[11px] text-primary">
                    숙어 {w.idioms.length}개
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <select
                  value={w.status}
                  disabled={busy}
                  onChange={(e) =>
                    void setWordStatus(w, e.target.value as WordStatus)
                  }
                  className="rounded-lg border border-border bg-background px-1.5 py-1 text-[10px]"
                >
                  <option value="unknown">모름</option>
                  <option value="learning">아는 중</option>
                  <option value="mastered">외움</option>
                </select>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(w)}
                  className="rounded-lg border border-destructive/40 px-1.5 py-1 text-[10px] text-destructive"
                >
                  삭제
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StatsPanel({ adminUserId }: { adminUserId: string }) {
  const [userId, setUserId] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [summary, setSummary] = useState<{
    userCount: number;
    usersWithWords: number;
    activeReviewers7d: number;
    todayAdded: number;
    words: { unknown: number; learning: number; mastered: number; total: number };
    recentReviews: number;
    recentAccuracy: number;
  } | null>(null);
  const [topWrong, setTopWrong] = useState<
    { id: string; word: string; wrong_count: number; status: string }[]
  >([]);

  useEffect(() => {
    void adminFetch<{ users: AdminUser[] }>("/api/admin/users", adminUserId).then(
      (res) => {
        if (res.ok) setUsers(res.data.users);
      }
    );
  }, [adminUserId]);

  const load = useCallback(async () => {
    const qs = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    const res = await adminFetch<{
      summary: NonNullable<typeof summary>;
      topWrong: typeof topWrong;
    }>(`/api/admin/stats${qs}`, adminUserId);
    if (res.ok) {
      setSummary(res.data.summary);
      setTopWrong(res.data.topWrong);
    }
  }, [adminUserId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-3">
      <select
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
      >
        <option value="">전체 사용자</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
      {summary && (
        <div className="grid grid-cols-2 gap-2">
          <Stat label="가입 유저" value={String(summary.userCount)} />
          <Stat label="단어 있는 유저" value={String(summary.usersWithWords)} />
          <Stat label="7일 복습 유저" value={String(summary.activeReviewers7d)} />
          <Stat label="오늘 추가 단어" value={String(summary.todayAdded)} />
          <Stat label="단어 총합" value={String(summary.words.total)} />
          <Stat label="최근 정답률" value={`${summary.recentAccuracy}%`} />
          <Stat label="모름" value={String(summary.words.unknown)} />
          <Stat label="외움" value={String(summary.words.mastered)} />
        </div>
      )}
      <div className="rounded-2xl border border-border bg-card p-3">
        <p className="text-sm font-medium">오답 많은 단어 TOP</p>
        <ul className="mt-2 space-y-1 text-xs">
          {topWrong.length === 0 && (
            <li className="text-muted-foreground">없음</li>
          )}
          {topWrong.map((w) => (
            <li key={w.id} className="flex justify-between gap-2">
              <span>{w.word}</span>
              <span className="text-muted-foreground">{w.wrong_count}회</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PushPanel({
  adminUserId,
  onMessage,
}: {
  adminUserId: string;
  onMessage: (m: string | null) => void;
}) {
  const [subs, setSubs] = useState<
    {
      user_id: string;
      userName: string;
      remind_hour_kst: number;
      last_notified_on: string | null;
      endpointHost: string;
    }[]
  >([]);
  const [byHour, setByHour] = useState<{ hour: number; count: number }[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await adminFetch<{
      subscriptions: typeof subs;
      byHour: typeof byHour;
      total: number;
    }>("/api/admin/push", adminUserId);
    if (!res.ok) {
      onMessage(res.error);
      return;
    }
    setSubs(res.data.subscriptions);
    setByHour(res.data.byHour);
  }, [adminUserId, onMessage]);

  useEffect(() => {
    void load();
  }, [load]);

  const testPush = async (userId: string, name: string) => {
    setBusy(true);
    const res = await adminFetch("/api/admin/push", adminUserId, {
      method: "POST",
      json: { userId },
    });
    setBusy(false);
    if (!res.ok) {
      onMessage(res.error);
      return;
    }
    onMessage(`${name} 님에게 테스트 푸시를 보냈어요.`);
  };

  const uniqueUsers = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of subs) map.set(s.user_id, s.userName);
    return Array.from(map.entries());
  }, [subs]);

  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-3 text-sm">
        <p className="font-medium">구독 {subs.length}대</p>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          {byHour.map((h) => (
            <span key={h.hour} className="rounded-lg bg-muted px-2 py-1">
              {formatHourKst(h.hour)} · {h.count}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">테스트 발송</p>
        {uniqueUsers.map(([id, name]) => (
          <button
            key={id}
            type="button"
            disabled={busy}
            onClick={() => void testPush(id, name)}
            className="mr-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold"
          >
            {name}
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {subs.map((s, i) => (
          <li
            key={`${s.user_id}-${s.endpointHost}-${i}`}
            className="rounded-2xl border border-border bg-card px-3 py-2 text-xs"
          >
            <p className="font-semibold">{s.userName}</p>
            <p className="text-muted-foreground">
              {formatHourKst(s.remind_hour_kst)} · {s.endpointHost}
            </p>
            <p className="text-muted-foreground">
              마지막 알림: {s.last_notified_on || "없음"}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SystemPanel({
  adminUserId,
  onMessage,
}: {
  adminUserId: string;
  onMessage: (m: string | null) => void;
}) {
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiLimit, setAiLimit] = useState(20);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await adminFetch<{
        settings: {
          ai_enabled?: boolean;
          ai_daily_limit?: number;
          notice_text?: string;
        };
        warning?: string;
      }>("/api/admin/settings", adminUserId);
      if (!res.ok) {
        onMessage(res.error);
        return;
      }
      if (res.data.warning) {
        onMessage(
          `설정 테이블 확인: ${res.data.warning} (supabase-migration-admin.sql 실행 권장)`
        );
      }
      const s = res.data.settings;
      setAiEnabled(s.ai_enabled === true);
      setAiLimit(Number(s.ai_daily_limit ?? 20));
      setNotice(typeof s.notice_text === "string" ? s.notice_text : "");
    })();
  }, [adminUserId, onMessage]);

  const save = async () => {
    setBusy(true);
    const res = await adminFetch("/api/admin/settings", adminUserId, {
      method: "PATCH",
      json: {
        settings: {
          ai_enabled: aiEnabled,
          ai_daily_limit: aiLimit,
          notice_text: notice,
        },
      },
    });
    setBusy(false);
    if (!res.ok) {
      onMessage(res.error);
      return;
    }
    onMessage("시스템 설정을 저장했어요.");
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>AI 기능 사용</span>
        <input
          type="checkbox"
          checked={aiEnabled}
          onChange={(e) => setAiEnabled(e.target.checked)}
        />
      </label>
      <label className="block text-sm">
        <span className="text-muted-foreground">AI 일일 한도</span>
        <input
          type="number"
          min={0}
          value={aiLimit}
          onChange={(e) => setAiLimit(Number(e.target.value) || 0)}
          className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3"
        />
      </label>
      <label className="block text-sm">
        <span className="text-muted-foreground">홈 공지 (한 줄)</span>
        <input
          value={notice}
          onChange={(e) => setNotice(e.target.value)}
          className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3"
          placeholder="비우면 공지 없음"
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        저장
      </button>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}
