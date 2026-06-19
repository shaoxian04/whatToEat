import { describe, it, expect } from "vitest";
import { clientIp } from "./client-ip";

function makeReq(headers: Record<string, string>): Request {
  return new Request("http://localhost/", { headers });
}

describe("clientIp", () => {
  it("prefers x-vercel-forwarded-for over x-forwarded-for when both are set", () => {
    const req = makeReq({
      "x-vercel-forwarded-for": "1.2.3.4, 5.6.7.8",
      "x-forwarded-for": "9.9.9.9",
    });
    expect(clientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip when only that header is set", () => {
    const req = makeReq({ "x-real-ip": "2.3.4.5" });
    expect(clientIp(req)).toBe("2.3.4.5");
  });

  it("falls back to the first hop of x-forwarded-for when only that header is set", () => {
    const req = makeReq({ "x-forwarded-for": "3.4.5.6, 7.8.9.0" });
    expect(clientIp(req)).toBe("3.4.5.6");
  });

  it('returns "no-ip" when no IP headers are present', () => {
    const req = makeReq({});
    expect(clientIp(req)).toBe("no-ip");
  });
});
