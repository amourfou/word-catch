import { NextRequest, NextResponse } from "next/server";
import { parseLearnersResponse } from "@/lib/dictionary";

export const dynamic = "force-dynamic";

/** Proxy Merriam-Webster Learner's Dictionary. Reference only — never writes to DB. */
export async function GET(req: NextRequest) {
  const word = req.nextUrl.searchParams.get("word")?.trim() ?? "";
  if (!word) {
    return NextResponse.json({ message: "단어가 비어 있어요." }, { status: 400 });
  }

  const safe = word.split(/\s+/)[0].replace(/[^a-zA-Z'-]/g, "");
  if (!safe) {
    return NextResponse.json(
      { message: "영어 단어만 조회할 수 있어요." },
      { status: 400 }
    );
  }

  const apiKey = process.env.MERRIAM_WEBSTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { message: "사전 API 키가 설정되지 않았어요." },
      { status: 500 }
    );
  }

  try {
    const upstream = await fetch(
      `https://www.dictionaryapi.com/api/v3/references/learners/json/${encodeURIComponent(safe.toLowerCase())}?key=${encodeURIComponent(apiKey)}`,
      { next: { revalidate: 86400 } }
    );

    const data: unknown = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json(
        { message: "사전 서버에 연결하지 못했어요." },
        { status: 502 }
      );
    }

    // Invalid key often returns a plain string
    if (typeof data === "string") {
      return NextResponse.json(
        { message: "사전 API 키를 확인해 주세요." },
        { status: 502 }
      );
    }

    const entry = parseLearnersResponse(data, safe);
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
