import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createSupabaseVoteRepository } from "@/lib/vote/supabase-repository";
import type { VoteRepository } from "@/lib/vote/repository";

let testRepo: VoteRepository | null = null;
export function __setRepositoryForTests(repo: VoteRepository | null) { testRepo = repo; }
function getRepository(): VoteRepository {
  if (testRepo) return testRepo;
  return createSupabaseVoteRepository(createServiceClient());
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const state = await getRepository().getSession(id);
    if (!state) return NextResponse.json({ error: "This lunch vote was not found." }, { status: 404 });
    return NextResponse.json(state);
  } catch {
    return NextResponse.json({ error: "Could not load the vote." }, { status: 500 });
  }
}
