import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pricesCheap, pricesLatest, pricesRoundTrip } from "./client";

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

describe("pricesCheap", () => {
  it("flattens the nested /v1/prices/cheap response into TpLatestPrice[]", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            AER: {
              "0": {
                price: 4200,
                airline: "U6",
                departure_at: "2026-09-10T08:00:00Z",
                return_at: null,
                number_of_changes: 0,
              },
            },
          },
        }),
    } as unknown as Response);

    const result = await pricesCheap({ origin: "EKB", destination: "AER", departDate: "2026-09" });

    expect(result).toEqual([
      {
        origin: "EKB",
        destination: "AER",
        depart_date: "2026-09-10",
        return_date: null,
        value: 4200,
        airline: "U6",
        number_of_changes: 0,
      },
    ]);

    const calledUrl = String(spy.mock.calls[0][0]);
    expect(calledUrl).toContain("/v1/prices/cheap");
    expect(calledUrl).toContain("origin=EKB");
    expect(calledUrl).toContain("destination=AER");
    expect(calledUrl).toContain("depart_date=2026-09");
    expect(calledUrl).toContain("currency=rub");
    expect(calledUrl).toContain("token=test-token");
  });

  it("returns an empty array when there is no data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    } as unknown as Response);
    const result = await pricesCheap({ origin: "MOW", destination: "IST", departDate: "2026-10" });
    expect(result).toEqual([]);
  });
});

describe("pricesRoundTrip", () => {
  it("calls /aviasales/v3/prices_for_dates with both dates and one_way=false", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        success: true,
        data: [
          {
            origin: "SVX",
            destination: "IST",
            departure_at: "2026-08-12T10:00:00+05:00",
            return_at: "2026-08-20T14:00:00+03:00",
            price: 31000,
            airline: "TK",
            transfers: 0,
          },
        ],
      }),
    );

    const result = await pricesRoundTrip({
      origin: "SVX",
      destination: "IST",
      departDate: "2026-08-12",
      returnDate: "2026-08-20",
    });

    expect(result).toEqual([
      {
        origin: "SVX",
        destination: "IST",
        depart_date: "2026-08-12",
        return_date: "2026-08-20",
        value: 31000,
        airline: "TK",
        number_of_changes: 0,
      },
    ]);

    const calledUrl = String(spy.mock.calls[0][0]);
    expect(calledUrl).toContain("/aviasales/v3/prices_for_dates");
    expect(calledUrl).toContain("departure_at=2026-08-12");
    expect(calledUrl).toContain("return_at=2026-08-20");
    expect(calledUrl).toContain("one_way=false");
    expect(calledUrl).toContain("token=test-token");
  });

  it("falls back to the requested dates when the row omits them", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ success: true, data: [{ price: 25000 }] }),
    );
    const result = await pricesRoundTrip({
      origin: "SVX",
      destination: "AYT",
      departDate: "2026-09-01",
      returnDate: "2026-09-10",
    });
    expect(result[0]).toMatchObject({
      origin: "SVX",
      destination: "AYT",
      depart_date: "2026-09-01",
      return_date: "2026-09-10",
      value: 25000,
    });
  });

  it("returns an empty array when there is no data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ success: true }));
    const result = await pricesRoundTrip({
      origin: "MOW",
      destination: "IST",
      departDate: "2026-10-01",
      returnDate: "2026-10-08",
    });
    expect(result).toEqual([]);
  });
});
