import { NextRequest, NextResponse } from "next/server";
import {
  parseLearnersResponse,
  peekLearnersHeadword,
} from "@/lib/dictionary";
import {
  getCachedDictionaryEntry,
  normalizeWordKey,
  saveDictionaryCache,
} from "@/lib/dictionaryCache";

export const dynamic = "force-dynamic";

/** Cache-first Merriam-Webster Learner's Dictionary proxy. */
export async function GET(req: NextRequest) {
  const word = req.nextUrl.searchParams.get("word")?.trim() ?? "";
  if (!word) {
    return NextResponse.json({ message: "단어가 비어 있어요." }, { status: 400 });
  }

  const wordKey = normalizeWordKey(word);
  if (!wordKey) {
    return NextResponse.json(
      { message: "영어 단어만 조회할 수 있어요." },
      { status: 400 }
    );
  }

  const cached = await getCachedDictionaryEntry(wordKey);
  if (cached) {
    return NextResponse.json({
      entry: cached,
      exact: true,
      fromCache: true,
    });
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
      `https://www.dictionaryapi.com/api/v3/references/learners/json/${encodeURIComponent(wordKey)}?key=${encodeURIComponent(apiKey)}`,
      { cache: "no-store" }
    );

    const data: unknown = await upstream.json();

    if (!upstream.ok) {
      return NextResponse.json(
        { message: "사전 서버에 연결하지 못했어요." },
        { status: 502 }
      );
    }

    if (typeof data === "string") {
      return NextResponse.json(
        { message: "사전 API 키를 확인해 주세요." },
        { status: 502 }
      );
    }

    const entry = parseLearnersResponse(data, wordKey);
    if (entry && entry.word.toLowerCase() === wordKey) {
      await saveDictionaryCache({ wordKey, entry, raw: data });
      return NextResponse.json({ entry, exact: true, fromCache: false });
    }

    // Related/stem hit (e.g. intensively → intensive): verified, but no cache/audio.
    const suggested = peekLearnersHeadword(data);
    if (suggested) {
      return NextResponse.json({
        exact: false,
        suggested,
        entry: null,
      });
    }

    return NextResponse.json(
      { message: "사전에서 찾을 수 없어요." },
      { status: 404 }
    );
  } catch {
    return NextResponse.json(
      { message: "사전 서버에 연결하지 못했어요." },
      { status: 502 }
    );
  }
}
