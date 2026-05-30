import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      select: () => ({
        limit: () =>
          Promise.resolve({
            error: null,
            data: [{ user_id: "00000000-0000-0000-0000-000000000000" }],
          }),
      }),
    }),
  }),
  createClient: vi.fn(),
}));

describe("GET /api/health", () => {
  it("returns 200 with status ok and db reachable", async () => {
    const { GET } = await import("./route");
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.db).toBe("reachable");
  });
});
