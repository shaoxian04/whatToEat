import { NextResponse } from "next/server";
import { searchArea, type AreaResult } from "@/lib/places/client";
import { createRateLimiter } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";
import { createTtlCache } from "@/lib/ttl-cache";

const allow = createRateLimiter(20, 60_000);
const allowGlobal = createRateLimiter(200, 60_000);

const cache = createTtlCache<AreaResult>(24 * 60 * 60_000, 1000);
export function __clearAreaCacheForTests() { cache.clear(); }

export async function POST(req: Request): Promise<Response> {
  const perIpOk = allow(clientIp(req));
  const globalOk = allowGlobal("__global__");
  if (!perIpOk || !globalOk) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  let body: { query?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (query.length < 2) return NextResponse.json({ error: "Enter an area or address." }, { status: 400 });
  if (query.length > 200) return NextResponse.json({ error: "That search is too long." }, { status: 400 });

  const key = query.toLowerCase();
  const cached = cache.get(key);
  if (cached) return NextResponse.json(cached);

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server is missing its Places API key." }, { status: 500 });
  }

  try {
    const result = await searchArea({ query, apiKey });
    if (!result) return NextResponse.json({ error: "We couldn't find that place." }, { status: 404 });
    cache.set(key, result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[area] search failed:", err);
    return NextResponse.json({ error: "Could not search for that place. Please try again." }, { status: 500 });
  }
}
