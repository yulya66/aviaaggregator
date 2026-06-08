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
  /** Flights FROM this hub. Omit to query by destination only. */
  origin?: string;
  /** Flights INTO this hub (e.g. Тбилиси → Екатеринбург). */
  destination?: string;
  limit?: number;
};

export type PricesCheapParams = {
  origin: string;
  destination: string;
  /** "YYYY-MM" (month) or "YYYY-MM-DD". */
  departDate: string;
};

export type PricesCalendarParams = {
  origin: string;
  destination: string;
  /** Month to scan, "YYYY-MM-01". */
  month: string;
};

/** One day in the /v1/prices/calendar response (keyed by departure date). */
type TpCalendarEntry = {
  price?: number; // calendar uses `price`
  value?: number; // …some variants use `value` — accept both
  departure_at?: string; // ISO datetime; the date we want is the first 10 chars
  depart_date?: string;
  airline?: string | null;
  transfers?: number; // calendar uses `transfers`
  number_of_changes?: number;
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
  destination,
  limit = 200,
}: PricesLatestParams): Promise<TpLatestPrice[]> {
  const url = new URL(`${TP_BASE}/v2/prices/latest`);
  if (origin) url.searchParams.set("origin", origin);
  if (destination) url.searchParams.set("destination", destination);
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

/**
 * Cheapest fare per departure day across a month for one exact route.
 * Used by the "I know where I want to go" route search — a calendar of dates,
 * unlike prices/latest which returns a single cheapest fare per route.
 */
export async function pricesCalendar({
  origin,
  destination,
  month,
}: PricesCalendarParams): Promise<TpLatestPrice[]> {
  const url = new URL(`${TP_BASE}/v1/prices/calendar`);
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("depart_date", month.slice(0, 7)); // "YYYY-MM"
  url.searchParams.set("calendar_type", "departure_date");
  url.searchParams.set("currency", "rub");
  url.searchParams.set("token", tpToken());

  const json = await fetchJson<{ success: boolean; data?: Record<string, TpCalendarEntry> }>(
    url.toString(),
  );

  const out: TpLatestPrice[] = [];
  for (const [date, e] of Object.entries(json.data ?? {})) {
    const price = e?.price ?? e?.value;
    if (!price) continue;
    out.push({
      origin,
      destination,
      depart_date: (e.departure_at ?? e.depart_date ?? date).slice(0, 10),
      return_date: null, // route search shows one-way fares
      value: price,
      airline: e.airline ?? null,
      number_of_changes: e.transfers ?? e.number_of_changes ?? 0,
    });
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
