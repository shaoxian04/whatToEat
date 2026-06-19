import { NextResponse } from "next/server";
import { fetchNearby } from "@/lib/places/client";
import { createRateLimiter } from "@/lib/rate-limit";

const allow = createRateLimiter(30, 60_000); // 30 req/min per IP

export async function POST(req: Request): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!allow(ip)) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server is missing its Places API key." }, { status: 500 });
  }

  let body: { lat?: number; lng?: number; radiusMeters?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { lat, lng, radiusMeters } = body;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "lat and lng are required numbers." }, { status: 400 });
  }

  try {
    const restaurants = await fetchNearby({
      lat,
      lng,
      radiusMeters: typeof radiusMeters === "number" ? radiusMeters : 1500,
      apiKey,
    });
    return NextResponse.json({ restaurants });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the restaurant service. Please try again." },
      { status: 500 },
    );
  }
}
