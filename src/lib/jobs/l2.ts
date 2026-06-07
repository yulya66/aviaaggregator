import type { SupabaseClient } from "@supabase/supabase-js";
import type { TpClient } from "@/lib/tp/client";
import { type DealRow, dedupeCheapest, type SnapshotRow, toDeal, toSnapshot } from "./shared";

// SVX = Екатеринбург (Кольцово). NB: "EKB" is Ekibastuz, KZ — do not use it for Yekaterinburg.
export const HOME_HUBS = ["SVX", "MOW", "LED"] as const;

export type JobResult = { api_calls: number; rows_inserted: number };

export async function runPollL2(
  supabase: SupabaseClient,
  tp: TpClient,
  marker: string,
): Promise<JobResult> {
  const nowIso = new Date().toISOString();
  let apiCalls = 0;
  const snapshots: SnapshotRow[] = [];
  const deals: DealRow[] = [];

  for (const origin of HOME_HUBS) {
    const results = await tp.pricesLatest({ origin, limit: 200 });
    apiCalls++;
    for (const p of dedupeCheapest(results)) {
      snapshots.push(toSnapshot(origin, p));
      deals.push(toDeal(origin, p, marker, nowIso));
    }
  }

  if (snapshots.length > 0) {
    const { error } = await supabase.rpc("record_snapshots", { p_rows: snapshots });
    if (error) throw new Error(`record_snapshots failed: ${JSON.stringify(error)}`);
  }

  if (deals.length > 0) {
    const { error } = await supabase
      .from("deals")
      .upsert(deals, { onConflict: "origin_iata,destination_iata,depart_date" });
    if (error) throw new Error(`deals upsert failed: ${JSON.stringify(error)}`);
  }

  // Deactivate deals not refreshed in the last 48h.
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  await supabase.from("deals").update({ is_active: false }).lt("last_seen_at", cutoff);

  return { api_calls: apiCalls, rows_inserted: deals.length };
}
