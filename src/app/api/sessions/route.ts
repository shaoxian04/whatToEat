import { NextResponse } from "next/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/server";
import { createSupabaseVoteRepository } from "@/lib/vote/supabase-repository";
import type { VoteRepository } from "@/lib/vote/repository";

const allow = createRateLimiter(20, 60_000);

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

export async function POST(req: Request): Promise<Response> {
  if (!allow(clientIp(req))) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }
  let body: { hostName?: unknown; options?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const hostName = typeof body.hostName === "string" ? body.hostName.trim() : "";
  if (!hostName) return NextResponse.json({ error: "hostName is required." }, { status: 400 });

  if (!Array.isArray(body.options) || body.options.length < 2) {
    return NextResponse.json({ error: "At least 2 options are required." }, { status: 400 });
  }
  const options: { name: string; placeId?: string | null; snapshot?: unknown }[] = [];
  for (const raw of body.options) {
    const name = typeof (raw as { name?: unknown })?.name === "string"
      ? (raw as { name: string }).name.trim() : "";
    if (!name) return NextResponse.json({ error: "Every option needs a name." }, { status: 400 });
    const placeId = (raw as { placeId?: unknown }).placeId;
    const snapshot = (raw as { snapshot?: unknown }).snapshot;
    options.push({ name, placeId: typeof placeId === "string" ? placeId : null, snapshot: snapshot ?? null });
  }

  try {
    const { sessionId } = await getRepository().createSession({ hostName, options });
    return NextResponse.json({ sessionId }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not create the vote. Please try again." }, { status: 500 });
  }
}
