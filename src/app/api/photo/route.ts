import { NextResponse } from "next/server";
import { fetchPhotoUri, PHOTO_NAME_RE } from "@/lib/places/client";
import { createRateLimiter } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";
import { createTtlCache } from "@/lib/ttl-cache";

const allow = createRateLimiter(120, 60_000);
const allowGlobal = createRateLimiter(1200, 60_000);

// Photo lookups are billed per call; remember resolved URLs for an hour.
const cache = createTtlCache<string>(60 * 60_000, 2000);
export function __clearPhotoCacheForTests() { cache.clear(); }

const WIDTH = 400;

export async function GET(req: Request): Promise<Response> {
  const name = new URL(req.url).searchParams.get("name") ?? "";
  if (!PHOTO_NAME_RE.test(name)) {
    return NextResponse.json({ error: "Invalid photo name." }, { status: 400 });
  }

  const cached = cache.get(name);
  if (cached) return redirect(cached);

  const perIpOk = allow(clientIp(req));
  const globalOk = allowGlobal("__global__");
  if (!perIpOk || !globalOk) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server is missing its Places API key." }, { status: 500 });
  }

  try {
    const uri = await fetchPhotoUri({ name, maxWidthPx: WIDTH, apiKey });
    cache.set(name, uri);
    return redirect(uri);
  } catch (err) {
    console.error("[photo] fetch failed:", err);
    return NextResponse.json({ error: "Photo unavailable." }, { status: 502 });
  }
}

function redirect(uri: string): Response {
  const res = NextResponse.redirect(uri, 302);
  res.headers.set("Cache-Control", "public, max-age=3600");
  return res;
}
