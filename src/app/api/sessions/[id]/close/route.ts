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
  const hostToken = req.headers.get("x-host-token") ?? "";
  try {
    const result = await getRepository().closeSession(id, hostToken);
    if ("error" in result) {
      if (result.error === "forbidden") {
        return NextResponse.json({ error: result.error }, { status: 403 });
      }
      const status = result.error === "not_found" ? 404 : 409;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ winnerId: result.winnerId });
  } catch {
    return NextResponse.json({ error: "Could not close the vote." }, { status: 500 });
  }
}
