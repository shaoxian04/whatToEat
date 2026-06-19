import { NextResponse } from "next/server";
import { createRateLimiter } from "@/lib/rate-limit";
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

function clientIp(req: Request): string {
  return req.headers.get("x-real-ip")?.trim()
    || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "no-ip";
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
  let body: { voterName?: unknown; optionId?: unknown; type?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const voterName = typeof body.voterName === "string" ? body.voterName.trim() : "";
  const optionId = typeof body.optionId === "string" ? body.optionId : "";
  const type = body.type;

  if (!voterName || !optionId || (type !== "up" && type !== "veto")) {
    return NextResponse.json({ error: "voterName, optionId and a valid type are required." }, { status: 400 });
  }
  if (voterName.length > 80) {
    return NextResponse.json({ error: "voterName is too long." }, { status: 400 });
  }

  try {
    const result = await getRepository().castVote(id, { voterName, optionId, type });
    if (result.ok) return NextResponse.json({ ok: true });
    const status = result.reason === "not_found" ? 404
      : result.reason === "bad_option" ? 400
      : 409; // duplicate | closed
    return NextResponse.json({ error: result.reason }, { status });
  } catch {
    return NextResponse.json({ error: "Could not record your vote." }, { status: 500 });
  }
}
