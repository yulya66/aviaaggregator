import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pricesLatest } from "./client";

beforeEach(() => {
  process.env.TP_API_KEY = "test-token";
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env.TP_API_KEY = "";
});

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: () => Promise.resolve(body) } as unknown as Response;
}

describe("pricesLatest", () => {
  it("calls /v2/prices/latest with required query params and returns data[]", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: [
          {
            origin: "EKB",
            destination: "AER",
            depart_date: "2026-09-10",
            return_date: null,
            value: 4200,
            airline: "U6",
            number_of_changes: 0,
          },
        ],
      }),
    );

    const result = await pricesLatest({ origin: "EKB", limit: 200 });

    expect(result).toHaveLength(1);
    expect(result[0].destination).toBe("AER");

    const calledUrl = String(spy.mock.calls[0][0]);
    expect(calledUrl).toContain("/v2/prices/latest");
    expect(calledUrl).toContain("origin=EKB");
    expect(calledUrl).toContain("currency=rub");
    expect(calledUrl).toContain("one_way=true");
    expect(calledUrl).toContain("limit=200");
    expect(calledUrl).toContain("token=test-token");
  });

  it("throws when TP_API_KEY is missing", async () => {
    process.env.TP_API_KEY = "";
    await expect(pricesLatest({ origin: "EKB" })).rejects.toThrow(/TP_API_KEY/);
  });

  it("returns an empty array when the API yields no data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ success: true }));
    const result = await pricesLatest({ origin: "MOW" });
    expect(result).toEqual([]);
  });
});
