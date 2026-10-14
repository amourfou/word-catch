#!/usr/bin/env node
/**
 * One-time bootstrap: set a user's 6-digit PIN in public.user_pins.
 * Use it for the very first super_admin; after that, set PINs from the admin screen.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... node scripts/set-pin.mjs "광란의 사랑"
 *   (or: node --env-file=.env.local scripts/set-pin.mjs "광란의 사랑")
 *
 * The PIN is typed at a hidden prompt (no echo). It is never accepted as an
 * argument, never printed, and never written to a file.
 */
import crypto from "node:crypto";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

const scrypt = promisify(crypto.scrypt);
const N = 16384;

function promptHidden(question) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) return reject(new Error("터미널에서 직접 실행해 주세요 (PIN은 숨김 입력만 받습니다)."));
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (ch) => {
      for (const c of ch) {
        if (c === "\r" || c === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          stdout.write("\n");
          return resolve(value);
        }
        if (c === "\u0003") {
          stdin.setRawMode(false);
          stdout.write("\n");
          process.exit(130);
        }
        if (c === "\u007f" || c === "\b") value = value.slice(0, -1);
        else value += c;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const name = (process.argv[2] || "").trim();
  if (!name || process.argv.length > 3) {
    console.error('사용법: node scripts/set-pin.mjs "<이름>"   (PIN은 인자로 받지 않습니다)');
    process.exit(2);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.");
    process.exit(2);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: user, error } = await db.from("users").select("id, name, role").eq("name", name).maybeSingle();
  if (error) throw new Error(`users 조회 실패: ${error.message}`);
  if (!user) {
    console.error(`"${name}" 사용자를 찾지 못했습니다.`);
    process.exit(1);
  }
  const pin = await promptHidden(`${user.name} (${user.role ?? "user"}) 새 PIN 6자리: `);
  const again = await promptHidden("한 번 더: ");
  if (!/^\d{6}$/.test(pin)) {
    console.error("PIN은 숫자 6자리여야 합니다.");
    process.exit(1);
  }
  if (pin !== again) {
    console.error("두 번 입력한 PIN이 다릅니다.");
    process.exit(1);
  }
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(pin, salt, 32, { N, r: 8, p: 1 });
  const pin_hash = `scrypt$${N}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
  const { error: upErr } = await db
    .from("user_pins")
    .upsert({ user_id: user.id, pin_hash, failed_count: 0, locked_until: null, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (upErr) throw new Error(`user_pins 저장 실패: ${upErr.message} (01_shared_tables.sql 을 먼저 실행했는지 확인)`);
  console.log(`완료: ${user.name} 의 PIN을 저장했습니다.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
