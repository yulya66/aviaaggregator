# Research — Travelpayouts flight_search (real-time) API

> Deliverable of Task 1 of `docs/superpowers/plans/2026-06-08-plan-live-price-check.md`.
> Gathered from Travelpayouts Help Center + API reference (June 2026). Endpoints shown as documented (http://) — **use https:// in code**. Some exact JSON field paths must be re-confirmed against a live response during implementation (Task 2 fixture).

## TL;DR for our design
- Live search is **async**: `POST /v1/flight_search` → `search_id`, then **poll** `GET /v1/flight_search_results?uuid=<id>` until done. Results live ~15 min on TP's side.
- The request must be **signed** (md5 of token + nesting-aware-sorted param values, colon-joined).
- **🚨 COMPLIANCE (architecture-defining):** you may **NOT** auto-collect booking links. The agency/booking URL must be generated **only when the user actually clicks "Book/Купить"** (via the `clicks` endpoint). Auto-harvesting all links → TP **disables your search API**. So: live-search → show **prices** from proposals; generate the **buy URL on click only**.
- **Rate limit:** ~**200 searches / hour / IP**. → on-demand only, per-IP throttle + budget guard (plan Task 3/6).

## 1. Endpoints
- **Init:** `POST https://api.travelpayouts.com/v1/flight_search` — body = signed JSON (below) → returns `search_id` (uuid) and a `results_url` host.
- **Poll results:** `GET https://api.travelpayouts.com/v1/flight_search_results?uuid=<search_id>` — call repeatedly; proposals stream in across chunks.
- **Booking link (ON CLICK ONLY):** `GET https://<results_url>/searches/<search_id>/clicks/<proposal_id>.json` → returns the agency redirect URL (carries the marker). Link has a **short lifetime**; if expired, re-run the search.

## 2. Init request body
```json
{
  "signature": "<md5 — see §3>",
  "marker": "537159",
  "host": "aviatop.vercel.app",
  "user_ip": "<end user IP>",
  "locale": "ru",
  "trip_class": "Y",
  "passengers": { "adults": 1, "children": 0, "infants": 0 },
  "segments": [
    { "origin": "SVX", "destination": "IST", "date": "2026-09-12" }
  ]
}
```
- `trip_class`: `Y` economy / `C` business (UPPERCASE).
- `locale`: en-us | en-gb | ru | de | es | fr | pl.
- `host`: our site/app identifier — use the prod domain (`aviatop.vercel.app`).
- `user_ip`: the real end-user IP (forward `x-forwarded-for` from the request, not the server's).
- `segments`: one entry for one-way; two for round-trip (return leg origin/destination swapped).

## 3. Signature (md5)
Recipe (from "How to create a signature (md-5)"):
1. Sort the params **alphabetically by key, nesting-aware**: a nested object (`passengers`) or array (`segments`) is sorted **within itself** and kept **in its slot** in the top-level order (its inner values are NOT merged into the top-level sort).
2. Concatenate **only the VALUES**, in that order, separated by **`:`**.
3. **Prefix the partner token** (TP_API_KEY) to that string.
4. `md5(...)` of the whole thing → `signature`.

For our fields the value order is:
```
token : host : locale : marker : (passengers: adults : children : infants)
      : (segments: [date : destination : origin] ...) : trip_class : user_ip
```
(top-level keys sorted: host, locale, marker, passengers, segments, trip_class, user_ip; passengers inner sorted: adults, children, infants; each segment inner sorted: date, destination, origin.)

TS sketch (confirm against a fixture in Task 2):
```ts
import { createHash } from "node:crypto";

function flatValues(v: unknown): string[] {
  if (Array.isArray(v)) return v.flatMap(flatValues);
  if (v && typeof v === "object")
    return Object.keys(v as Record<string, unknown>)
      .sort()
      .flatMap((k) => flatValues((v as Record<string, unknown>)[k]));
  return [String(v)];
}

function signFlightSearch(token: string, params: Record<string, unknown>): string {
  const values = [token, ...flatValues(params)];
  return createHash("md5").update(values.join(":")).digest("hex");
}
```
⚠️ The exact treatment of arrays-of-objects (segments) ordering is the #1 risk — validate against a known-good signature (TP docs example or a working library: `mahnunchik/travelpayouts` Node, `travelpayouts/flights-api-project` PHP) before trusting it.

## 4. Polling contract
- After init, GET `flight_search_results?uuid=<id>` repeatedly.
- Each response is a JSON array of chunks; proposals accumulate across calls.
- **Done when** the array contains only an element with just the `search_id` (no more proposal chunks).
- Results stored ~**15 minutes**, then deleted → re-search if stale.
- **Vercel 10s limit:** can't hold a 30s poll in one function. Split: init + a few polls within ~8s → if not done, return `{status:"pending", searchId, resultsUrl}`; client calls a continuation route to keep polling.

## 5. Response → cheapest price
- Result chunks contain `proposals` (a.k.a. tickets); each proposal = an offer from one agency.
- `proposal.terms` (and `xterms`) hold pricing per gate: total price + currency. Cheapest = min over all proposals' terms (in RUB; request `currency`/locale ru for RUB).
- Keep the **proposal_id** of the cheapest → needed for the click link.
- **Exact JSON paths** (proposals[].terms[gateId].price / unified_price, currency, proposal id field) — confirm with a saved live response in Task 2 and store as `test/fixtures/tp-live-search.json`.

## 6. Rate limits & compliance
- **~200 searches/hour/IP** (airline tickets search). → live-search **only on user action**, per-IP throttle, budget guard; log usage.
- **No auto-collection of booking links** — generate the `clicks` URL **only on the user's Book click**. Violation → API disabled. This is why the deal page shows price (from proposals) but fetches the buy URL on click.

## 7. Implications for the plan (refinements)
- `lib/tp/live-search.ts`: `signFlightSearch`, `initSearch(params)→{searchId, resultsUrl}`, `pollResults(resultsUrl, searchId)→Proposal[]`, `cheapestProposal(proposals)`, and a SEPARATE `bookingLink(resultsUrl, searchId, proposalId)` that is called **only** from the Buy click handler.
- `/api/live-search` returns price + `searchId` + `resultsUrl` + cheapest `proposalId`, but **not** a pre-fetched buy URL. The Buy button hits `/api/live-search/book` which calls the clicks endpoint then 302-redirects.
- Forward the end-user IP (`x-forwarded-for`) into `user_ip`.
- Token + signing stay **server-side** (never ship token/signature logic to the browser).

## 8. Open questions to close during implementation
- Exact `results_url` field name in the init response, and exact `clicks` URL format (`.json` suffix? path).
- Exact proposal/terms JSON paths for price + currency + proposal id.
- Whether one-way needs `trip_class` + both segments or just one.
- Confirm the signature against a working library before building.

## Sources
- [How to create a signature (md-5)](https://support.travelpayouts.com/hc/en-us/articles/210996008-How-to-create-a-signature-md-5)
- [Aviasales Flights Search API: real-time and multi-city search](https://support.travelpayouts.com/hc/en-us/articles/30565016140434-Aviasales-Flights-Search-API-real-time-and-multi-city-search)
- [Aviasales Flights Search API (old version)](https://support.travelpayouts.com/hc/en-us/articles/203956173-Aviasales-Flights-Search-API-old-version)
- [FAQ about Aviasales API](https://support.travelpayouts.com/hc/en-us/articles/204529267-FAQ-about-Aviasales-API)
- [API Reference (slate)](https://travelpayouts.github.io/slate/)
- [travelpayouts/flights-api-project (PHP reference)](https://github.com/travelpayouts/flights-api-project)
- [mahnunchik/travelpayouts (Node library)](https://github.com/mahnunchik/travelpayouts)
