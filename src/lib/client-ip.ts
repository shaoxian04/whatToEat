// Best-effort client IP for COARSE per-IP rate limiting. Per-IP attribution is
// inherently spoofable when clients can set forwarding headers, so the GLOBAL
// rate-limit cap in each route is the real backstop. We prefer infrastructure-set
// headers that clients cannot forge (e.g. Vercel's x-vercel-forwarded-for) before
// falling back to conventional proxy headers.
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "no-ip"
  );
}
