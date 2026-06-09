import type { SupabaseClient } from "@supabase/supabase-js";
import { HOME_HUB_CODES } from "@/data/hubs";
import type { TpClient } from "@/lib/tp/client";
import {
  chunk,
  type DealRow,
  dedupeCheapest,
  type SnapshotRow,
  toDeal,
  toSnapshot,
} from "./shared";

// Hub codes live in @/data/hubs (single source of truth).
export const HOME_HUBS = HOME_HUB_CODES;

export type JobResult = { api_calls: number; rows_inserted: number };

export async function runPollL2(
  supabase: SupabaseClient,
  tp: TpClient,
  marker: string,
): Promise<JobResult> {
  const nowIso = new Date().toISOString();
  // Outbound (FROM each home hub) + inbound (INTO each home hub, e.g. Тбилиси → Екатеринбург),
  // all in parallel to stay within the Vercel function time limit.
  // limit=1000 (TP max) — same 1 API call per hub, ~5× wider destination coverage.
  const tasks = HOME_HUBS.flatMap((hub) => [
    tp.pricesLatest({ origin: hub, limit: 1000 }).then((rows) => ({ inbound: false, hub, rows })),
    tp
      .pricesLatest({ destination: hub, limit: 1000 })
      .then((rows) => ({ inbound: true, hub, rows })),
  ]);
  const settled = await Promise.allSettled(tasks);
  const apiCalls = settled.length;

  // Dedupe globally by route, keeping the cheapest. A home↔home route appears in both an
  // outbound and an inbound result set; Postgres rejects two updates to the same row in one
  // upsert ("ON CONFLICT DO UPDATE cannot affect row a second time"), so we collapse here.
  const snapByRoute = new Map<string, SnapshotRow>();
  const dealByRoute = new Map<string, DealRow>();
  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    const { inbound, hub, rows } = s.value;
    for (const p of dedupeCheapest(rows)) {
      const origin = inbound ? p.origin : hub;
      const key = `${origin}_${p.destination}_${p.depart_date}`;
      const existing = snapByRoute.get(key);
      if (!existing || p.value < existing.price_rub) {
        snapByRoute.set(key, toSnapshot(origin, p));
        dealByRoute.set(key, toDeal(origin, p, marker, nowIso));
      }
    }
  }
  const snapshots = [...snapByRoute.values()];
  const deals = [...dealByRoute.values()];

  // Chunked writes: with limit=1000 a poll can carry ~10k rows — keep statements bounded.
  for (const batch of chunk(snapshots)) {
    const { error } = await supabase.rpc("record_snapshots", { p_rows: batch });
    if (error) throw new Error(`record_snapshots failed: ${JSON.stringify(error)}`);
  }

  for (const batch of chunk(deals)) {
    const { error } = await supabase
      .from("deals")
      .upsert(batch, { onConflict: "origin_iata,destination_iata,depart_date" });
    if (error) throw new Error(`deals upsert failed: ${JSON.stringify(error)}`);
  }

  // Deactivate deals not refreshed in the last 48h.
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  await supabase.from("deals").update({ is_active: false }).lt("last_seen_at", cutoff);

  return { api_calls: apiCalls, rows_inserted: deals.length };
}
