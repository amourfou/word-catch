import "server-only";
import { ApiError } from "@/lib/server/http";
import { PHOTO_WORDS_PROMPT, PHOTO_WORDS_SCHEMA, parseExtractionText, type PhotoWordItem } from "@/lib/photoWords";

/** 모델은 환경변수로만 바꾼다. 기본은 StudyCatch와 같은 gpt-6-luna. */
export function photoWordsModel(): string {
  return (process.env.WC_PHOTO_MODEL || "gpt-6-luna").trim();
}

export const PHOTO_MAX_BYTES = 6 * 1024 * 1024;
export type PhotoMime = "image/jpeg" | "image/png" | "image/webp";

/** 실제 파일 앞부분(매직 바이트)으로 형식 확인 */
export function sniffPhotoMime(b: Uint8Array): PhotoMime | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

/** 사진은 메모리에서만 쓰고 저장하지 않는다. OpenAI에도 store:false. */
export async function extractWordsFromPhoto(data: Buffer, mime: PhotoMime): Promise<{ items: PhotoWordItem[]; model: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new ApiError(503, "AI 기능이 아직 켜지지 않았어요(서버에 OpenAI 키 없음).");
  const model = photoWordsModel();
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: PHOTO_WORDS_PROMPT },
          { type: "input_image", image_url: `data:${mime};base64,${data.toString("base64")}`, detail: "high" },
        ],
      }],
      text: { format: { type: "json_schema", name: "photo_words", strict: true, schema: PHOTO_WORDS_SCHEMA } },
    }),
    signal: AbortSignal.timeout(90_000),
  }).catch(() => null);
  if (!r) throw new ApiError(504, "AI 응답이 너무 늦어요. 잠시 후 다시 해 주세요.");
  const j = (await r.json().catch(() => ({}))) as Record<string, any>;
  if (!r.ok) {
    console.error("[photo-words] openai error", r.status, j?.error?.code);
    throw new ApiError(502, "AI가 지금 응답하지 않아요. 잠시 후 다시 해 주세요.");
  }
  const text: string =
    j.output_text ??
    (j.output ?? []).flatMap((o: any) => o.content ?? []).find((c: any) => c.type === "output_text")?.text ??
    "";
  const u = j.usage ?? {};
  console.log(`[photo-words] model=${model} in=${u.input_tokens ?? 0} out=${u.output_tokens ?? 0}`);
  return { items: parseExtractionText(text), model };
}
