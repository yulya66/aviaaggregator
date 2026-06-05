import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { TpCheapClient, TpLatestPrice } from "@/lib/tp/client";
import { runPollL1 } from "./l1";

function price(partial: Partial<TpLatestPrice>): TpLatestPrice {
  return {
    origin: "EKB",
    destination: "AER",
    depart_date: "2026-09-10",
    return_date: null,
    value: 4200,
    airline: "U6",
    number_of_changes: 0,
    ...partial,
  };
}

function makeFakeDb(searches: unknown[]) {
  const select = vi.fn().mockResolvedValue({ data: searches, error: null });
  const rpc = vi.fn().mockResolvedValue({ error: null });
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn((table: string) => {
    if (table === "saved_searches") return { select };
    return { upsert }; // deals
  });
  const db = { from, rpc } as unknown as SupabaseClient;
  return { db, select, rpc, upsert, from };
}

const SEARCH = {
  id: "11111111-1111-1111-1111-111111111111",
  origin_iata: "EKB",
  destination_iata: "AER",
  date_from: "2026-09-01",
  date_to: "2026-09-30",
  max_price_rub: 5000,
};

describe("runPollL1", () => {
  it("records a deal when the cheapest in-window price is at/under the threshold", async () => {
    const { db, rpc, upsert } = makeFakeDb([SEARCH]);
    const tp: TpCheapClient = {
      pricesCheap: vi
        .fn()
        .mockResolvedValue([
          price({ depart_date: "2026-09-10", value: 4200 }),
          price({ depart_date: "2026-09-15", value: 6000 }),
        ]),
    };

    const result = await runPollL1(db, tp, "555");

    expect(tp.pricesCheap).toHaveBeenCalledWith({
      origin: "EKB",
      destination: "AER",
      departDate: "2026-09",
    });
    expect(result.api_calls).toBe(1);
    expect(rpc).toHaveBeenCalledWith(
      "record_snapshots",
      expect.objectContaining({ p_rows: expect.any(Array) }),
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ onConflict: "origin_iata,destination_iata,depart_date" }),
    );
    expect(result.rows_inserted).toBe(1);
  });

  it("inserts nothing when the cheapest in-window price exceeds the threshold", async () => {
    const { db, upsert } = makeFakeDb([SEARCH]);
    const tp: TpCheapClient = {
      pricesCheap: vi.fn().mockResolvedValue([price({ depart_date: "2026-09-10", value: 8000 })]),
    };

    const result = await runPollL1(db, tp, "555");

    expect(result.rows_inserted).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("ignores prices outside the date window", async () => {
    const { db, upsert } = makeFakeDb([SEARCH]);
    const tp: TpCheapClient = {
      pricesCheap: vi.fn().mockResolvedValue([price({ depart_date: "2026-10-05", value: 100 })]),
    };

    const result = await runPollL1(db, tp, "555");

    expect(result.rows_inserted).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("skips saved searches with a null destination (anywhere)", async () => {
    const { db } = makeFakeDb([{ ...SEARCH, destination_iata: null }]);
    const tp: TpCheapClient = { pricesCheap: vi.fn() };

    const result = await runPollL1(db, tp, "555");

    expect(tp.pricesCheap).not.toHaveBeenCalled();
    expect(result.api_calls).toBe(0);
    expect(result.rows_inserted).toBe(0);
  });
});
