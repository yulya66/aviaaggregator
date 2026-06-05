import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({
    from: () => ({ insert: vi.fn().mockResolvedValue({ error: null }) }),
  }),
  createClient: vi.fn(),
}));

vi.mock("@/lib/jobs/l2", () => ({
  runPollL2: vi.fn().mockResolvedValue({ api_calls: 3, rows_inserted: 10 }),
}));

vi.mock("@/lib/jobs/l1", () => ({
  runPollL1: vi.fn().mockResolvedValue({ api_calls: 2, rows_inserted: 1 }),
}));

vi.mock("@/lib/jobs/l3", () => ({
  runPollL3: vi.fn().mockResolvedValue({ api_calls: 1, rows_inserted: 200, anomalies_detected: 2 }),
}));

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  process.env.CRON_BEARER_TOKEN = "secret-token";
  process.env.TP_API_KEY = "tp-token";
  process.env.TP_PARTNER_MARKER = "555";
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
    const res = await POST(makeRequest(null), { params: Promise.resolve({ job: "poll_l2" }) });
    expect(res.status).toBe(401);
  });

  it("returns 401 when the Bearer token mismatches", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest("wrong"), { params: Promise.resolve({ job: "poll_l2" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown job names", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest("secret-token", "poll_unknown"), {
      params: Promise.resolve({ job: "poll_unknown" }),
    });
    expect(res.status).toBe(404);
  });

  it("runs poll_l2 and returns 200 with the job result", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest("secret-token", "poll_l2"), {
      params: Promise.resolve({ job: "poll_l2" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.job).toBe("poll_l2");
    expect(body.rows_inserted).toBe(10);
  });

  it("runs poll_l1 and returns 200 with the job result", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest("secret-token", "poll_l1"), {
      params: Promise.resolve({ job: "poll_l1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.job).toBe("poll_l1");
    expect(body.rows_inserted).toBe(1);
  });

  it("runs poll_l3 and returns 200", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest("secret-token", "poll_l3"), {
      params: Promise.resolve({ job: "poll_l3" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.anomalies_detected).toBe(2);
  });

  it("still returns 501 for not-yet-implemented jobs", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest("secret-token", "poll_vi"), {
      params: Promise.resolve({ job: "poll_vi" }),
    });
    expect(res.status).toBe(501);
  });
});
