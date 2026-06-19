import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createServiceClient } from "@/lib/supabase/server";
import { createBrowserSupabase } from "@/lib/supabase/browser";

const OLD = { ...process.env };
beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://x.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
});
afterEach(() => { process.env = { ...OLD }; });

describe("supabase client factories", () => {
  it("createServiceClient builds a client when env is present", () => {
    expect(createServiceClient()).toBeTruthy();
  });
  it("createServiceClient throws when the service key is missing", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => createServiceClient()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });
  it("createBrowserSupabase throws when the anon key is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(() => createBrowserSupabase()).toThrow(/ANON/);
  });
});
