// '오늘의 단어' 알림 테스트: 지정한 이름의 사용자 1명의 기기에만 1회 발송한다.
// DB는 읽기만 한다(last_notified_on 등 갱신 없음). 비밀값은 출력하지 않는다.
// 사용법: node scripts/test-word-of-day.mjs "사용자이름"
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import fs from "fs";

const name = process.argv[2];
if (!name) { console.error("사용자 이름이 필요합니다."); process.exit(1); }

const env = { ...process.env };
for (const f of [".env", ".env.local", ".env.production", ".env.production.local"]) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    if (!l || l.startsWith("#") || !l.includes("=")) continue;
    const i = l.indexOf("=");
    env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: users, error: uErr } = await sb.from("users").select("id, name").eq("name", name);
if (uErr) { console.error("users 조회 실패", uErr.message); process.exit(1); }
if ((users ?? []).length !== 1) { console.error(`이름이 정확히 1명과 맞지 않음: ${users?.length ?? 0}명 → 발송 안 함`); process.exit(1); }
const userId = users[0].id;

const { data: subs, error: sErr } = await sb.from("push_subscriptions")
  .select("endpoint, p256dh, auth, user_id").eq("app", "wordcatch").eq("user_id", userId);
if (sErr) { console.error("구독 조회 실패", sErr.message); process.exit(1); }
const mine = (subs ?? []).filter((s) => s.user_id === userId);
console.log("대상 사용자 기기 수", mine.length);
if (!mine.length) process.exit(1);

const { data: words } = await sb.from("wordcatch_words")
  .select("word, meanings, status, wrong_count").eq("user_id", userId)
  .or("status.eq.unknown,wrong_count.gt.0").order("wrong_count", { ascending: false }).limit(10);
const cand = (words ?? []).filter((w) => w.word && (w.meanings ?? []).some((m) => m && m.trim()));
const w = cand[0];
const body = w
  ? `오늘의 단어: ${w.word.trim()} — ${w.meanings.find((m) => m && m.trim()).trim()}\n눌러서 복습해 볼까요?`
  : "아직 오늘 복습이 없어요. 잠깐만 해볼까요?";
console.log("본문", body.replace(/\n/g, " / "));

webpush.setVapidDetails(env.VAPID_SUBJECT || "mailto:wordcatch@example.com", env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
let ok = 0, fail = 0;
for (const s of mine) {
  try {
    const r = await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      JSON.stringify({ title: "WordCatch", body, url: "/review", tag: "wordcatch-test" }), { TTL: 3600 });
    console.log("발송 성공", new URL(s.endpoint).host, r.statusCode); ok++;
  } catch (e) { console.log("발송 실패", new URL(s.endpoint).host, e.statusCode); fail++; }
}
console.log("완료 성공", ok, "실패", fail);
