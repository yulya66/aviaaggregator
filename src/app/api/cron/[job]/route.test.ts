import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  process.env.CRON_BEARER_TOKEN = "secret-token";
  vi.resetModules();
});

function makeRequest(token: string | null, job = "poll_l2") {
  const headers = new Headers();
  if (token !== null) headers.set("authorization", `Bearer ${token}`);
  return new Request(`http://localhost/api/cron/${job}`, { method: "POST", headers });
}

describe("POST /api/cron/[job]", () => {
  it("returns 401 when no Bearer token is provided", async () => {
    const { POST } = await import("./route");
    const req = makeRequest(null);
    const res = await POST(req, { params: Promise.resolve({ job: "poll_l2" }) });
    expect(res.status).toBe(401);
  });

  it("returns 401 when Bearer token mismatches", async () => {
    const { POST } = await import("./route");
    const req = makeRequest("wrong-token");
    const res = await POST(req, { params: Promise.resolve({ job: "poll_l2" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown job names", async () => {
    const { POST } = await import("./route");
    const req = makeRequest("secret-token", "poll_unknown");
    const res = await POST(req, { params: Promise.resolve({ job: "poll_unknown" }) });
    expect(res.status).toBe(404);
  });

  it("returns 501 for known job stubs", async () => {
    const { POST } = await import("./route");
    const req = makeRequest("secret-token", "poll_l2");
    const res = await POST(req, { params: Promise.resolve({ job: "poll_l2" }) });
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.job).toBe("poll_l2");
  });
});
