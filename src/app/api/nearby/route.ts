import { NextResponse } from "next/server";
import { fetchNearby } from "@/lib/places/client";
import { createRateLimiter } from "@/lib/rate-limit";

// x-real-ip is platform-validated on Vercel; the global cap below is the real
// backstop regardless of IP attribution.
const allow = createRateLimiter(30, 60_000); // 30 req/min per IP
const allowGlobal = createRateLimiter(300, 60_000); // 300 req/min global

export async function POST(req: Request): Promise<Response> {
  // Prefer platform-validated x-real-ip; fall back to x-forwarded-for first hop.
  // All unattributed requests share the single "no-ip" bucket.
  const ip =
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "no-ip";

  // Evaluate both limiters so both counters always advance.
  const perIpOk = allow(ip);
  const globalOk = allowGlobal("__global__");
  if (!perIpOk || !globalOk) {
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server is missing its Places API key." }, { status: 500 });
  }

  let body: { lat?: unknown; lng?: unknown; radiusMeters?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { lat, lng, radiusMeters } = body;

  // Validate coordinates: must be finite numbers within valid geographic ranges.
  if (
    !Number.isFinite(lat as number) ||
    (lat as number) < -90 ||
    (lat as number) > 90 ||
    !Number.isFinite(lng as number) ||
    (lng as number) < -180 ||
    (lng as number) > 180
  ) {
    return NextResponse.json({ error: "lat and lng must be valid coordinates." }, { status: 400 });
  }

  // Validate radiusMeters: if provided, must be a finite number.
  if (radiusMeters !== undefined && !Number.isFinite(radiusMeters as number)) {
    return NextResponse.json({ error: "radiusMeters must be a finite number." }, { status: 400 });
  }

  // Clamp radius to a safe range to prevent cost/quota abuse.
  const radius = Math.min(
    Math.max(typeof radiusMeters === "number" ? radiusMeters : 1500, 100),
    5000,
  );

  try {
    const restaurants = await fetchNearby({
      lat: lat as number,
      lng: lng as number,
      radiusMeters: radius,
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
