import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { TpClient, TpLatestPrice } from "@/lib/tp/client";
import { HOME_HUBS, runPollL2 } from "./l2";

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

function makeFakeDb() {
  const rpc = vi.fn().mockResolvedValue({ error: null });
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const lt = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ lt }));
  const from = vi.fn(() => ({ upsert, update }));
  const db = { rpc, from } as unknown as SupabaseClient;
  return { db, rpc, upsert, update, lt, from };
}

describe("runPollL2", () => {
  it("polls all three home hubs and upserts snapshots + deals", async () => {
    const { db, rpc, upsert } = makeFakeDb();
    const tp: TpClient = {
      pricesLatest: vi.fn().mockResolvedValue([price({ destination: "AER", value: 4200 })]),
    };

    const result = await runPollL2(db, tp, "555");

    expect(tp.pricesLatest).toHaveBeenCalledTimes(HOME_HUBS.length * 2); // outbound + inbound per hub
    expect(result.api_calls).toBe(HOME_HUBS.length * 2);
    expect(rpc).toHaveBeenCalledWith(
      "record_snapshots",
      expect.objectContaining({ p_rows: expect.any(Array) }),
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ onConflict: "origin_iata,destination_iata,depart_date" }),
    );
    expect(result.rows_inserted).toBeGreaterThan(0);
  });

  it("deactivates stale deals via update().lt(last_seen_at)", async () => {
    const { db, update, lt } = makeFakeDb();
    const tp: TpClient = { pricesLatest: vi.fn().mockResolvedValue([]) };

    await runPollL2(db, tp, "555");

    expect(update).toHaveBeenCalledWith({ is_active: false });
    expect(lt).toHaveBeenCalledWith("last_seen_at", expect.any(String));
  });
});
