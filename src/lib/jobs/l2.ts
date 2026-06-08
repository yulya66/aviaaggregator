import type { SupabaseClient } from "@supabase/supabase-js";
import type { TpClient } from "@/lib/tp/client";
import { type DealRow, dedupeCheapest, type SnapshotRow, toDeal, toSnapshot } from "./shared";

// Home hubs. SVX = Екатеринбург (Кольцово) — NB: "EKB" is Ekibastuz, KZ.
// CEK = Челябинск, PEE = Пермь.
export const HOME_HUBS = ["SVX", "MOW", "LED", "CEK", "PEE"] as const;

export type JobResult = { api_calls: number; rows_inserted: number };

export async function runPollL2(
  supabase: SupabaseClient,
  tp: TpClient,
  marker: string,
): Promise<JobResult> {
  const nowIso = new Date().toISOString();
  const snapshots: SnapshotRow[] = [];
  const deals: DealRow[] = [];

  // Outbound (FROM each home hub) + inbound (INTO each home hub, e.g. Тбилиси → Екатеринбург),
  // all in parallel to stay within the Vercel function time limit.
  const tasks = HOME_HUBS.flatMap((hub) => [
    tp.pricesLatest({ origin: hub, limit: 200 }).then((rows) => ({ inbound: false, hub, rows })),
    tp
      .pricesLatest({ destination: hub, limit: 200 })
      .then((rows) => ({ inbound: true, hub, rows })),
  ]);
  const settled = await Promise.allSettled(tasks);
  const apiCalls = settled.length;

  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    const { inbound, hub, rows } = s.value;
    for (const p of dedupeCheapest(rows)) {
      // Outbound: the hub is the origin. Inbound: the flight's own origin → into the hub.
      const origin = inbound ? p.origin : hub;
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
