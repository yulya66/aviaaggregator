import { createHash } from "node:crypto";

// Travelpayouts real-time flight search (flight_search). See docs/research/tp-flight-search.md.
// Signing + token stay server-side. Booking links are fetched ONLY on user click (compliance).

const TP_BASE = "https://api.travelpayouts.com";

function tpToken(): string {
  const t = process.env.TP_API_KEY;
  if (!t || t.trim().length === 0) throw new Error("Missing required env var: TP_API_KEY");
  return t.trim();
}

function tpMarker(): string {
  return process.env.TP_PARTNER_MARKER ?? "";
}

export type Passengers = { adults: number; children: number; infants: number };
export type Segment = { origin: string; destination: string; date: string };

export type SearchParams = {
  host: string;
  user_ip: string;
  locale: string;
  trip_class: string;
  passengers: Passengers;
  segments: Segment[];
};

/** Nesting-aware: sort keys alphabetically at each level, flatten to a list of string values. */
export function flatValues(v: unknown): string[] {
  if (Array.isArray(v)) return v.flatMap(flatValues);
  if (v && typeof v === "object") {
    return Object.keys(v as Record<string, unknown>)
      .sort()
      .flatMap((k) => flatValues((v as Record<string, unknown>)[k]));
  }
  return [String(v)];
}

/** md5( token : <param values in nesting-aware alphabetical order, colon-joined> ). */
export function signFlightSearch(token: string, paramsWithMarker: Record<string, unknown>): string {
  const str = [token, ...flatValues(paramsWithMarker)].join(":");
  return createHash("md5").update(str).digest("hex");
}

export type InitResult = {
  search_id?: string;
  results_url?: string;
  [k: string]: unknown;
};

/** Start a search → returns { search_id, results_url } (plus raw fields for debugging). */
export async function initSearch(params: SearchParams): Promise<InitResult> {
  const full = { ...params, marker: tpMarker() };
  const signature = signFlightSearch(tpToken(), full);
  const res = await fetch(`${TP_BASE}/v1/flight_search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signature, ...full }),
  });
  return (await res.json()) as InitResult;
}
