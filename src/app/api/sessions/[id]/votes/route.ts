import { NextResponse } from "next/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";
import { createServiceClient } from "@/lib/supabase/server";
import { createSupabaseVoteRepository } from "@/lib/vote/supabase-repository";
import type { VoteRepository } from "@/lib/vote/repository";

const allow = createRateLimiter(60, 60_000);
const allowGlobal = createRateLimiter(600, 60_000);

let testRepo: VoteRepository | null = null;
export function __setRepositoryForTests(repo: VoteRepository | null) { testRepo = repo; }
function getRepository(): VoteRepository {
  if (testRepo) return testRepo;
  return createSupabaseVoteRepository(createServiceClient());
}


export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const perIpOk = allow(clientIp(req));
  const globalOk = allowGlobal("__global__");
  if (!perIpOk || !globalOk) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  const { id } = await ctx.params;
  let body: { voterName?: unknown; voterId?: unknown; optionId?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const voterName = typeof body.voterName === "string" ? body.voterName.trim() : "";
  const voterId = typeof body.voterId === "string" ? body.voterId.trim() : "";
  const optionId = typeof body.optionId === "string" ? body.optionId : "";

  if (!voterName || !voterId || !optionId) {
    return NextResponse.json({ error: "voterName, voterId and optionId are required." }, { status: 400 });
  }
  if (voterName.length > 80) {
    return NextResponse.json({ error: "voterName is too long." }, { status: 400 });
  }
  if (voterId.length > 64) {
    return NextResponse.json({ error: "voterId is too long." }, { status: 400 });
  }

  try {
    const result = await getRepository().castVote(id, { voterName, voterId, optionId });
    if (result.ok) return NextResponse.json({ ok: true });
    const status = result.reason === "not_found" ? 404
      : result.reason === "bad_option" ? 400
      : 409; // duplicate | closed | expired | name_taken
    return NextResponse.json({ error: result.reason }, { status });
  } catch (err) {
    console.error("[votes] cast failed:", err);
    return NextResponse.json({ error: "Could not record your vote." }, { status: 500 });
  }
}
