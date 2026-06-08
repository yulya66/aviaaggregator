import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAviasalesLink } from "@/lib/affiliate";
import { evaluateAnomaly } from "@/lib/anomaly";
import type { TpClient } from "@/lib/tp/client";
import {
  anomalyId,
  type DealRow,
  dedupeCheapest,
  type SnapshotRow,
  toDeal,
  toSnapshot,
} from "./shared";

// L3 scans these hubs for price anomalies, one per hour (round-robin).
// Home hubs (SVX/MOW/LED) + transit/third-country hubs.
export const TRANSIT_HUBS = [
  "SVX",
  "MOW",
  "LED",
  "CEK",
  "PEE",
  "TJM",
  "KUF",
  "EVN",
  "TBS",
  "IST",
  "DXB",
  "BEG",
  "HEL",
  "RIX",
  "TLL",
  "AYT",
  "KUT",
] as const;

export type L3Result = {
  api_calls: number;
  rows_inserted: number;
  anomalies_detected: number;
};

type Candidate = {
  destination_iata: string;
  depart_date: string;
  price_rub: number;
  airline: string | null;
  transfers: number;
  median: number | string;
  stddev: number | string;
  n: number | string;
};

export async function runPollL3(
  supabase: SupabaseClient,
  tp: TpClient,
  marker: string,
  hourOfDay: number,
): Promise<L3Result> {
  const hub = TRANSIT_HUBS[hourOfDay % TRANSIT_HUBS.length];
  const nowIso = new Date().toISOString();

  const results = await tp.pricesLatest({ origin: hub, limit: 300 });
  const cheapest = dedupeCheapest(results);
  const snapshots: SnapshotRow[] = cheapest.map((p) => toSnapshot(hub, p));
  const deals: DealRow[] = cheapest.map((p) => toDeal(hub, p, marker, nowIso));
  if (snapshots.length > 0) {
    const { error } = await supabase.rpc("record_snapshots", { p_rows: snapshots });
    if (error) throw new Error(`record_snapshots failed: ${JSON.stringify(error)}`);
  }
  // Surface every hub's fares in the shared feed (no extra API calls — same fetched data).
  if (deals.length > 0) {
    const { error: dealErr } = await supabase
      .from("deals")
      .upsert(deals, { onConflict: "origin_iata,destination_iata,depart_date" });
    if (dealErr) throw new Error(`deals upsert failed: ${JSON.stringify(dealErr)}`);
  }

  const { data, error } = await supabase.rpc("anomaly_candidates", { p_origin: hub });
  if (error) throw new Error(`anomaly_candidates failed: ${JSON.stringify(error)}`);
  const candidates = (data ?? []) as Candidate[];

  const anomalies = [];
  for (const c of candidates) {
    const verdict = evaluateAnomaly({
      price: c.price_rub,
      median: Number(c.median),
      stddev: Number(c.stddev),
      n: Number(c.n),
      transfers: c.transfers,
    });
    if (!verdict) continue;

    const id = anomalyId(hub, c.destination_iata, c.depart_date);
    anomalies.push({
      id,
      origin_iata: hub,
      destination_iata: c.destination_iata,
      depart_date: c.depart_date,
      return_date: null,
      price_rub: c.price_rub,
      median_price_rub: Math.round(Number(c.median)),
      discount_pct: verdict.discountPct,
      z_score: verdict.zScore,
      airline: c.airline,
      transfers: c.transfers,
      deep_link: buildAviasalesLink({
        origin: hub,
        destination: c.destination_iata,
        departDate: c.depart_date,
        marker,
        dealKind: "l3",
        dealId: id,
      }),
      is_active: true,
      detected_at: nowIso,
    });
  }

  if (anomalies.length > 0) {
    const { error: upsertError } = await supabase
      .from("anomalies")
      .upsert(anomalies, { onConflict: "origin_iata,destination_iata,depart_date" });
    if (upsertError) throw new Error(`anomalies upsert failed: ${JSON.stringify(upsertError)}`);
  }

  return {
    api_calls: 1,
    rows_inserted: snapshots.length,
    anomalies_detected: anomalies.length,
  };
}
