import { fetchJson } from "@/lib/http";

const TP_BASE = "https://api.travelpayouts.com";

/** One row from /v2/prices/latest (subset of fields we use). */
export type TpLatestPrice = {
  origin: string;
  destination: string;
  depart_date: string; // YYYY-MM-DD
  return_date: string | null;
  value: number; // price in the requested currency (rub)
  airline: string | null;
  number_of_changes: number;
};

export type PricesLatestParams = {
  origin: string;
  limit?: number;
};

export type PricesCheapParams = {
  origin: string;
  destination: string;
  /** "YYYY-MM" (month) or "YYYY-MM-DD". */
  departDate: string;
};

/** One entry inside the nested /v1/prices/cheap response. */
type TpCheapEntry = {
  price: number;
  airline: string | null;
  departure_at?: string;
  return_at?: string | null;
  number_of_changes?: number;
};

function tpToken(): string {
  const token = process.env.TP_API_KEY;
  if (!token || token.trim().length === 0) {
    throw new Error("Missing required env var: TP_API_KEY");
  }
  return token.trim();
}

export async function pricesLatest({
  origin,
  limit = 200,
}: PricesLatestParams): Promise<TpLatestPrice[]> {
  const url = new URL(`${TP_BASE}/v2/prices/latest`);
  url.searchParams.set("origin", origin);
  url.searchParams.set("currency", "rub");
  url.searchParams.set("period_type", "year");
  url.searchParams.set("one_way", "true");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("sorting", "price");
  url.searchParams.set("token", tpToken());

  const json = await fetchJson<{ success: boolean; data?: TpLatestPrice[] }>(url.toString());
  return json.data ?? [];
}

export async function pricesCheap({
  origin,
  destination,
  departDate,
}: PricesCheapParams): Promise<TpLatestPrice[]> {
  const url = new URL(`${TP_BASE}/v1/prices/cheap`);
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("depart_date", departDate);
  url.searchParams.set("currency", "rub");
  url.searchParams.set("token", tpToken());

  const json = await fetchJson<{
    success: boolean;
    data?: Record<string, Record<string, TpCheapEntry>>;
  }>(url.toString());

  const out: TpLatestPrice[] = [];
  for (const [dest, entries] of Object.entries(json.data ?? {})) {
    for (const entry of Object.values(entries)) {
      out.push({
        origin,
        destination: dest,
        depart_date: (entry.departure_at ?? "").slice(0, 10),
        return_date: entry.return_at ? entry.return_at.slice(0, 10) : null,
        value: entry.price,
        airline: entry.airline ?? null,
        number_of_changes: entry.number_of_changes ?? 0,
      });
    }
  }
  return out;
}

/** Injectable interfaces so job runners can be unit-tested without network. */
export type TpClient = {
  pricesLatest(params: PricesLatestParams): Promise<TpLatestPrice[]>;
};

export type TpCheapClient = {
  pricesCheap(params: PricesCheapParams): Promise<TpLatestPrice[]>;
};

export const tpClient: TpClient & TpCheapClient = { pricesLatest, pricesCheap };
