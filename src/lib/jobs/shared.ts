import { v5 as uuidv5 } from "uuid";
import { buildAviasalesLink } from "@/lib/affiliate";
import type { TpLatestPrice } from "@/lib/tp/client";

// Fixed namespaces (any constant UUIDs) so v5 ids are stable across runs/deploys.
const DEAL_NAMESPACE = "1b671a64-40d5-491e-99b0-da01ff1f3341";
const ANOMALY_NAMESPACE = "6fa459ea-ee8a-3ca4-894e-db77e160355e";

export function dealId(origin: string, p: TpLatestPrice): string {
  return uuidv5(`${origin}_${p.destination}_${p.depart_date}`, DEAL_NAMESPACE);
}

export function anomalyId(origin: string, destination: string, departDate: string): string {
  return uuidv5(`${origin}_${destination}_${departDate}`, ANOMALY_NAMESPACE);
}

export type SnapshotRow = {
  origin_iata: string;
  destination_iata: string;
  depart_date: string;
  return_date: string | null;
  price_rub: number;
  airline: string | null;
  transfers: number;
};

export function toSnapshot(origin: string, p: TpLatestPrice): SnapshotRow {
  return {
    origin_iata: origin,
    destination_iata: p.destination,
    depart_date: p.depart_date,
    // Travelpayouts returns "" (not null) for one-way return dates → coerce to null for the date column.
    return_date: p.return_date || null,
    price_rub: p.value,
    airline: p.airline ?? null,
    transfers: p.number_of_changes ?? 0,
  };
}

export type DealRow = SnapshotRow & {
  id: string;
  deep_link: string;
  is_active: boolean;
  last_seen_at: string;
};

export function toDeal(origin: string, p: TpLatestPrice, marker: string, nowIso: string): DealRow {
  const id = dealId(origin, p);
  return {
    ...toSnapshot(origin, p),
    id,
    deep_link: buildAviasalesLink({
      origin,
      destination: p.destination,
      departDate: p.depart_date,
      returnDate: p.return_date || null,
      marker,
      dealKind: "l2",
      dealId: id,
    }),
    is_active: true,
    last_seen_at: nowIso,
  };
}

/** Split rows into batches so a single upsert/RPC statement stays a sane size. */
export function chunk<T>(rows: T[], size = 1000): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

/** Keep only the cheapest price per (destination, depart_date). */
export function dedupeCheapest(prices: TpLatestPrice[]): TpLatestPrice[] {
  const best = new Map<string, TpLatestPrice>();
  for (const p of prices) {
    if (!p.depart_date) continue; // skip entries with no depart date (depart_date is NOT NULL)
    const key = `${p.origin}_${p.destination}_${p.depart_date}`;
    const current = best.get(key);
    if (!current || p.value < current.value) best.set(key, p);
  }
  return [...best.values()];
}
