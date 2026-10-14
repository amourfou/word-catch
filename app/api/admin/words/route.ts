import { NextResponse } from "next/server";
import {
  assertCanManageUser,
  getAdminCaller,
} from "@/lib/server/adminAuth";
import { supabase } from "@/lib/server/db";
import { type WordStatus } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await getAdminCaller();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId")?.trim();
  const q = url.searchParams.get("q")?.trim() ?? "";
  const status = url.searchParams.get("status")?.trim() ?? "all";
  const idiomsOnly = url.searchParams.get("idiomsOnly") === "1";

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const allowed = await assertCanManageUser(gate.caller, userId);
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  }

  let query = supabase
    .from("wordcatch_words")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(300);

  if (status !== "all") {
    query = query.eq("status", status);
  }
  if (q) {
    query = query.ilike("word", `%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let words = data ?? [];
  if (idiomsOnly) {
    words = words.filter(
      (w) => Array.isArray(w.idioms) && (w.idioms as unknown[]).length > 0
    );
  }

  return NextResponse.json({ ok: true, words });
}

export async function PATCH(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    wordId?: string;
    userId?: string;
    word?: string;
    meanings?: string[];
    memo?: string | null;
    source?: string | null;
    status?: WordStatus;
  };
  const gate = await getAdminCaller();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  if (!body.wordId || !body.userId) {
    return NextResponse.json(
      { error: "wordId and userId required" },
      { status: 400 }
    );
  }

  const allowed = await assertCanManageUser(gate.caller, body.userId);
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.word !== undefined) patch.word = body.word.trim();
  if (body.meanings !== undefined) patch.meanings = body.meanings;
  if (body.memo !== undefined) patch.memo = body.memo;
  if (body.source !== undefined) patch.source = body.source;
  if (body.status !== undefined) patch.status = body.status;

  const { data, error } = await supabase
    .from("wordcatch_words")
    .update(patch)
    .eq("id", body.wordId)
    .eq("user_id", body.userId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, word: data });
}

export async function DELETE(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    wordId?: string;
    userId?: string;
  };
  const gate = await getAdminCaller();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  if (!body.wordId || !body.userId) {
    return NextResponse.json(
      { error: "wordId and userId required" },
      { status: 400 }
    );
  }

  const allowed = await assertCanManageUser(gate.caller, body.userId);
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.error }, { status: allowed.status });
  }

  const { error } = await supabase
    .from("wordcatch_words")
    .delete()
    .eq("id", body.wordId)
    .eq("user_id", body.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
