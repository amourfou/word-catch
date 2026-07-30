import { NextRequest, NextResponse } from "next/server";
import { parseDictionaryResponse } from "@/lib/dictionary";

export const dynamic = "force-dynamic";

/** Proxy Free Dictionary API (avoids browser CORS). Reference only — never writes to DB. */
export async function GET(req: NextRequest) {
  const word = req.nextUrl.searchParams.get("word")?.trim() ?? "";
  if (!word) {
    return NextResponse.json({ message: "단어가 비어 있어요." }, { status: 400 });
  }

  // Only look up a single token-ish word
  const safe = word.split(/\s+/)[0].replace(/[^a-zA-Z'-]/g, "");
  if (!safe) {
    return NextResponse.json(
      { message: "영어 단어만 조회할 수 있어요." },
      { status: 400 }
    );
  }

  try {
    const upstream = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(safe.toLowerCase())}`,
      { next: { revalidate: 86400 } }
    );

    const data: unknown = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json(
        { message: "사전에서 찾을 수 없어요." },
        { status: upstream.status === 404 ? 404 : 502 }
      );
    }

    const entry = parseDictionaryResponse(data);
    if (!entry) {
      return NextResponse.json(
        { message: "사전에서 찾을 수 없어요." },
        { status: 404 }
      );
    }

    return NextResponse.json({ entry });
  } catch {
    return NextResponse.json(
      { message: "사전 서버에 연결하지 못했어요." },
      { status: 502 }
    );
  }
}
