import { promises as fs } from "fs";
import path from "path";

/**
 * 기기별 푸시 발송 결과 로그 (서버 로컬 JSONL 파일).
 * DB를 건드리지 않으려고 파일에 남긴다. 키나 p256dh/auth 같은 비밀값은 저장하지 않는다.
 */
export type PushSource = "scheduled" | "admin_test" | "self_test" | "broadcast";
export type PushResultKind = "ok" | "gone" | "error";

export type PushLogEntry = {
  at: string; // ISO 시각
  batchId: string; // 한 번의 발송(묶음) 단위
  source: PushSource;
  userId: string | null;
  endpointType: "fcm" | "apple" | "other";
  endpointHost: string;
  /** endpoint 끝 8자 (기기 구분용, 전체 URL은 남기지 않음) */
  endpointTail: string;
  httpStatus: number | null;
  result: PushResultKind;
  /** 구독 만료(404/410)로 자동 삭제했는지 */
  removed: boolean;
  error?: string;
};

const LOG_FILE = path.join(process.cwd(), "logs", "push-results.jsonl");
const MAX_BYTES = 2 * 1024 * 1024;

export function newBatchId(source: PushSource): string {
  return `${source}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function describeEndpoint(endpoint: string): {
  endpointType: PushLogEntry["endpointType"];
  endpointHost: string;
  endpointTail: string;
} {
  let host = "";
  try {
    host = new URL(endpoint).host;
  } catch {
    host = "(invalid)";
  }
  const endpointType = host.endsWith("fcm.googleapis.com")
    ? "fcm"
    : host.endsWith("push.apple.com")
      ? "apple"
      : "other";
  return { endpointType, endpointHost: host, endpointTail: endpoint.slice(-8) };
}

export async function appendPushLog(entry: PushLogEntry): Promise<void> {
  try {
    await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
    // 너무 커지면 한 번 돌려 둔다 (.1 하나만 유지)
    const st = await fs.stat(LOG_FILE).catch(() => null);
    if (st && st.size > MAX_BYTES) {
      await fs.rename(LOG_FILE, `${LOG_FILE}.1`).catch(() => undefined);
    }
    await fs.appendFile(LOG_FILE, JSON.stringify(entry) + "\n", "utf8");
  } catch (e) {
    console.error("appendPushLog", e);
  }
}

export async function readRecentPushLogs(limit = 200): Promise<PushLogEntry[]> {
  const text = await fs.readFile(LOG_FILE, "utf8").catch(() => "");
  const lines = text.split("\n").filter(Boolean);
  const out: PushLogEntry[] = [];
  for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
    try {
      out.push(JSON.parse(lines[i]) as PushLogEntry);
    } catch {
      /* 깨진 줄은 무시 */
    }
  }
  return out;
}
