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
  const dealsUpsert = vi.fn().mockResolvedValue({ error: null });
  const anomaliesUpsert = vi.fn().mockResolvedValue({ error: null });
  const rpc = vi.fn((fn: string) => {
    if (fn === "anomaly_candidates") return Promise.resolve({ data: candidates, error: null });
    return Promise.resolve({ data: null, error: null }); // record_snapshots
  });
  const from = vi.fn((table: string) => ({
    upsert: table === "anomalies" ? anomaliesUpsert : dealsUpsert,
  }));
  const db = { rpc, from } as unknown as SupabaseClient;
  return { db, rpc, dealsUpsert, anomaliesUpsert, from };
}

describe("runPollL3", () => {
  it("selects the hub by hour-of-day (round-robin)", async () => {
    const { db } = makeFakeDb([]);
    const tp: TpClient = { pricesLatest: vi.fn().mockResolvedValue([]) };

    await runPollL3(db, tp, "1", 2);

    expect(tp.pricesLatest).toHaveBeenCalledWith({ origin: TRANSIT_HUBS[2], limit: 300 });
  });

  it("upserts fetched fares as deals and flags anomalies from candidates", async () => {
    const { db, dealsUpsert, anomaliesUpsert } = makeFakeDb([
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

    // Part B: fetched fares go into the deals feed.
    expect(dealsUpsert).toHaveBeenCalledTimes(1);
    const [dealRows, dealOpts] = dealsUpsert.mock.calls[0];
    expect(dealRows).toHaveLength(1);
    expect(dealOpts).toMatchObject({ onConflict: "origin_iata,destination_iata,depart_date" });

    // Anomaly detection unchanged.
    expect(result.anomalies_detected).toBe(1);
    expect(anomaliesUpsert).toHaveBeenCalledTimes(1);
    const [rows, opts] = anomaliesUpsert.mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(rows[0].destination_iata).toBe("FCO");
    expect(rows[0].discount_pct).toBeCloseTo(72.22, 1);
    expect(rows[0].deep_link).toContain("marker=555.l3_");
    expect(opts).toMatchObject({ onConflict: "origin_iata,destination_iata,depart_date" });
  });

  it("inserts no anomalies during cold start (n < 10)", async () => {
    const { db, anomaliesUpsert } = makeFakeDb([
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
    expect(anomaliesUpsert).not.toHaveBeenCalled();
  });
});
