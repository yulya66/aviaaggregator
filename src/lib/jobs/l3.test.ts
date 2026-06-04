import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { TpClient } from "@/lib/tp/client";
import { runPollL3, TRANSIT_HUBS } from "./l3";

type Candidate = {
  destination_iata: string;
  depart_date: string;
  price_rub: number;
  airline: string | null;
  transfers: number;
  median: number;
  stddev: number;
  n: number;
};

function makeFakeDb(candidates: Candidate[]) {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const rpc = vi.fn((fn: string) => {
    if (fn === "anomaly_candidates") return Promise.resolve({ data: candidates, error: null });
    return Promise.resolve({ data: null, error: null }); // record_snapshots
  });
  const from = vi.fn(() => ({ upsert }));
  const db = { rpc, from } as unknown as SupabaseClient;
  return { db, rpc, upsert, from };
}

describe("runPollL3", () => {
  it("selects the transit hub by hour-of-day (round-robin)", async () => {
    const { db } = makeFakeDb([]);
    const tp: TpClient = { pricesLatest: vi.fn().mockResolvedValue([]) };

    await runPollL3(db, tp, "1", 2);

    expect(tp.pricesLatest).toHaveBeenCalledWith({ origin: TRANSIT_HUBS[2], limit: 300 });
  });

  it("inserts anomalies for candidates that pass the thresholds", async () => {
    const { db, upsert } = makeFakeDb([
      // Anomaly: 5000 vs median 18000 (72% off), n=30, 1 transfer
      {
        destination_iata: "FCO",
        depart_date: "2026-10-12",
        price_rub: 5000,
        airline: "PC",
        transfers: 1,
        median: 18000,
        stddev: 4000,
        n: 30,
      },
      // Not an anomaly: only 10% off
      {
        destination_iata: "BCN",
        depart_date: "2026-10-12",
        price_rub: 16200,
        airline: "PC",
        transfers: 1,
        median: 18000,
        stddev: 4000,
        n: 30,
      },
    ]);
    const tp: TpClient = {
      pricesLatest: vi.fn().mockResolvedValue([
        {
          origin: "EVN",
          destination: "FCO",
          depart_date: "2026-10-12",
          return_date: null,
          value: 5000,
          airline: "PC",
          number_of_changes: 1,
        },
      ]),
    };

    const result = await runPollL3(db, tp, "555", 0); // hour 0 -> TRANSIT_HUBS[0]

    expect(result.anomalies_detected).toBe(1);
    expect(upsert).toHaveBeenCalledTimes(1);
    const [rows, opts] = upsert.mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(rows[0].destination_iata).toBe("FCO");
    expect(rows[0].discount_pct).toBeCloseTo(72.22, 1);
    expect(rows[0].deep_link).toContain("marker=555.l3_");
    expect(opts).toMatchObject({ onConflict: "origin_iata,destination_iata,depart_date" });
  });

  it("inserts no anomalies during cold start (n < 10)", async () => {
    const { db, upsert } = makeFakeDb([
      {
        destination_iata: "FCO",
        depart_date: "2026-10-12",
        price_rub: 5000,
        airline: "PC",
        transfers: 1,
        median: 18000,
        stddev: 4000,
        n: 5,
      },
    ]);
    const tp: TpClient = { pricesLatest: vi.fn().mockResolvedValue([]) };

    const result = await runPollL3(db, tp, "555", 0);

    expect(result.anomalies_detected).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });
});
