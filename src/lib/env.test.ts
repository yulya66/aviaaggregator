import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const REQUIRED = {
  NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  CRON_BEARER_TOKEN: "cron-token",
};

describe("env", () => {
  const ORIGINAL = { ...process.env };

  beforeEach(() => {
    for (const [k, v] of Object.entries(REQUIRED)) process.env[k] = v;
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it("returns all required vars when present", async () => {
    const { env } = await import("./env");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://test.supabase.co");
    expect(env.CRON_BEARER_TOKEN).toBe("cron-token");
  });

  it("throws if a required var is missing", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    await expect(import("./env")).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("normalizes trailing slash on Supabase URL", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co/";
    const { env } = await import("./env");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://test.supabase.co");
  });
});
