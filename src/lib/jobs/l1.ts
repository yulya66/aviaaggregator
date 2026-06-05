import type { SupabaseClient } from "@supabase/supabase-js";
import type { TpCheapClient, TpLatestPrice } from "@/lib/tp/client";
import { type DealRow, type SnapshotRow, toDeal, toSnapshot } from "./shared";

export type SavedSearch = {
  id: string;
  origin_iata: string;
  destination_iata: string | null;
  date_from: string; // YYYY-MM-DD
  date_to: string; // YYYY-MM-DD
  max_price_rub: number;
};

export type JobResult = { api_calls: number; rows_inserted: number };

function cheapestInWindow(
  prices: TpLatestPrice[],
  from: string,
  to: string,
): TpLatestPrice | undefined {
  let best: TpLatestPrice | undefined;
  for (const p of prices) {
    if (p.depart_date < from || p.depart_date > to) continue;
    if (!best || p.value < best.value) best = p;
  }
  return best;
}

export async function runPollL1(
  supabase: SupabaseClient,
  tp: TpCheapClient,
  marker: string,
): Promise<JobResult> {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("saved_searches")
    .select("id, origin_iata, destination_iata, date_from, date_to, max_price_rub");
  if (error) throw new Error(`saved_searches read failed: ${JSON.stringify(error)}`);
  const searches = (data ?? []) as SavedSearch[];

  let apiCalls = 0;
  const snapshots: SnapshotRow[] = [];
  const deals: DealRow[] = [];

  for (const s of searches) {
    if (!s.destination_iata) continue; // "anywhere" not polled in this plan

    const departMonth = s.date_from.slice(0, 7); // YYYY-MM
    const results = await tp.pricesCheap({
      origin: s.origin_iata,
      destination: s.destination_iata,
      departDate: departMonth,
    });
    apiCalls++;

    const cheapest = cheapestInWindow(results, s.date_from, s.date_to);
    if (cheapest && cheapest.value <= s.max_price_rub) {
      snapshots.push(toSnapshot(s.origin_iata, cheapest));
      deals.push(toDeal(s.origin_iata, cheapest, marker, nowIso));
    }
  }

  if (snapshots.length > 0) {
    const { error: snapErr } = await supabase.rpc("record_snapshots", { p_rows: snapshots });
    if (snapErr) throw new Error(`record_snapshots failed: ${JSON.stringify(snapErr)}`);
  }
  if (deals.length > 0) {
    const { error: dealErr } = await supabase
      .from("deals")
      .upsert(deals, { onConflict: "origin_iata,destination_iata,depart_date" });
    if (dealErr) throw new Error(`deals upsert failed: ${JSON.stringify(dealErr)}`);
  }

  return { api_calls: apiCalls, rows_inserted: deals.length };
}
