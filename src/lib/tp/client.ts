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

/** Injectable interface so job runners can be unit-tested without network. */
export type TpClient = {
  pricesLatest(params: PricesLatestParams): Promise<TpLatestPrice[]>;
};

export const tpClient: TpClient = { pricesLatest };
