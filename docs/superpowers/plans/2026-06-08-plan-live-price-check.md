# Plan — Live Price Check (Travelpayouts flight_search) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. REQUIRED RESEARCH FIRST: this plan depends on Travelpayouts flight_search API details (request signing, init/poll endpoints, response shape) — Task 1 is a research task that MUST complete before Tasks 2+.

**Goal:** When a user opens a deal, fetch its **current, real** price via Travelpayouts live-search (an actual real-time search across agencies) instead of relying on the cached `prices/latest` data, so the price the user acts on matches what Aviasales shows.

**The problem this solves:** The feed (`prices/latest` / `prices/cheap`) returns **cached** fares that can lag live prices by hours/days. Users see one price in the feed, click through, and Aviasales shows another. Live-search closes that gap on demand.

**Why on-demand only:** Live-search is heavy (async, multi-second, signed, rate-limited separately from the data API). It is run **per click**, never in bulk over the feed.

**Tech Stack:** Next.js 15 (App Router, RSC + client island), TypeScript, existing `lib/http`, Travelpayouts **flight_search** API (v1). Builds on the current cached-feed app.

---

## UX decision (locked)

Two candidate flows:

- **A — Interstitial redirect** (`/go/[dealId]` → live-search → redirect to Aviasales): simplest, but the user stares at a blank "loading" for 5–30s. **Rejected** — too slow for a redirect.
- **B — Deal page with live price** (RECOMMENDED): clicking a card opens a deal page that shows the cached price immediately, kicks off a live-search, and updates to "✓ актуальная цена X ₽" (or "цена изменилась / билет пропал") with a confirmed **Купить** button. The user sees progress; the redirect link carries the verified fare.

**This plan implements B.**

---

## Travelpayouts flight_search — what to confirm in Task 1 (research)

The data API (`prices/latest`) ≠ flight_search. Live-search is a different, async product. Task 1 must verify against the official docs (https://support.travelpayouts.com/ / TP API reference):

1. **Request signing** — flight_search requires an MD5 **signature** of the sorted request params + the **partner token** + marker. Confirm the exact signature recipe (param ordering, nesting, host, locale, passengers, segments) — this is the #1 gotcha.
2. **Init endpoint** — `POST https://api.travelpayouts.com/v1/flight_search` with `{ signature, marker, host, user_ip, locale, trip_class, passengers, segments: [{origin, destination, date}] }` → returns `search_id`.
3. **Results polling** — `GET https://api.travelpayouts.com/v1/flight_search_results?uuid=<search_id>` returned repeatedly; results stream in and the response grows until the search is **done** (a terminal marker / empty `proposals` chunk). Confirm: poll interval, max duration, how to detect completion.
4. **Response shape** — how to read proposals → cheapest total price (RUB), the `gates`/agency, and the **deep link** (often a redirect via `/r?...` with the marker). Confirm how to build the buy URL from a proposal.
5. **Rate limits / quotas** — flight_search has its own limits (much lower than the data API). Confirm the per-day/per-minute cap → drives the budget guard (Task 6).

Output of Task 1: a short `docs/research/tp-flight-search.md` with the exact signature algorithm, endpoints, polling contract, response paths, and limits. **Do not write code until this exists.**

---

## Architecture

```
Click card ──▶ /deal/[id] (RSC: shows cached price instantly)
                    │  client island mounts
                    ▼
        POST /api/live-search        (our route — keeps token server-side, signs request)
            ├─ init flight_search → search_id
            └─ poll flight_search_results until done (server-side loop, ~Vercel 10s budget)
                    │
                    ▼
        { status: "ok"|"gone"|"timeout", priceRub, buyUrl }  ──▶ client updates UI
```

- `lib/tp/live-search.ts` — pure-ish module: `signRequest(params)`, `initSearch(params) → search_id`, `pollResults(search_id) → Proposal[]`, `cheapestProposal(proposals) → { priceRub, buyUrl } | null`. Reads `TP_API_KEY` + `TP_PARTNER_MARKER` lazily (same pattern as `lib/tp/client.ts`).
- `POST /api/live-search` — server route. Body: `{ origin, destination, departDate }` (+ optional returnDate). Bearer-less but rate-limited; never exposes the token. Returns the verdict JSON. Honors the **Vercel 10s function limit** — if the search isn't done in ~8s, return `status: "pending"` + the `search_id` so the client can poll `/api/live-search/results?id=` again (avoids the function timeout).
- `/deal/[id]` page — RSC reads the deal from `deals` by id, renders the cached price + a `<LivePrice>` client component that calls `/api/live-search` and renders the live verdict.
- `<LivePrice>` client component — states: `checking` (spinner "проверяем актуальную цену…"), `ok` (green "актуально: X ₽" + Купить→buyUrl), `changed` (amber "цена изменилась: было X, стало Y"), `gone` (gray "этот билет уже разобрали"), `error` (fallback: Купить→original cached deep link).

---

## Tasks

### Task 1: Research TP flight_search (BLOCKING)
Write `docs/research/tp-flight-search.md` covering the 5 items above (signing, init, poll, response, limits), verified against TP docs. No code. Gate for all later tasks.

### Task 2: `lib/tp/live-search.ts` + types (TDD where possible)
- `signRequest(params)`, `initSearch`, `pollResults`, `cheapestProposal`.
- Unit-test `signRequest` against a known fixture from Task 1, and `cheapestProposal` against a saved `flight_search_results` fixture (`test/fixtures/tp-live-search.json`). Mock `fetch` for init/poll — never hit the live API in tests (No-prod-API rule).

### Task 3: `POST /api/live-search` route (+ `/results` continuation)
- Validate body (origin/destination/departDate). Sign + init + poll within ~8s; if not done, return `{ status: "pending", searchId }`. `/api/live-search/results?id=` continues polling.
- Rate-limit per IP (simple in-memory or Supabase counter) so the live-search quota isn't burned by refreshes/bots.

### Task 4: `/deal/[id]` page (RSC)
- Read the deal from `deals` by id (cached price, route, date, cached deep_link). 404 if missing/inactive. Render cached price + `<LivePrice>` island.

### Task 5: `<LivePrice>` client component
- Calls `/api/live-search`, handles `pending` → poll `/results`, renders the 5 states above. Buy button uses the live `buyUrl` when `ok/changed`, else the cached `deep_link`.

### Task 6: Wire the feed → deal page + budget guard
- Card "Купить" (or the whole card) links to `/deal/[id]` instead of straight to Aviasales. Keep a small "сразу на Aviasales" secondary link as fallback.
- Budget guard: if the daily live-search quota (from Task 1) is near, skip the live call and show the cached price with a note. Log usage to `cron_runs`-style table or a `live_search_log`.

### Task 7: Verification
- `pnpm lint`/`typecheck`/`test`/`build` green. Manual smoke (with a real token, locally): open a deal → see "проверяем…" → resolves to a live price or "билет пропал". Confirm the buy link carries the marker.

---

## Risks / caveats
- **Latency:** live-search is 5–30s. The deal page shows the cached price instantly and updates async — never block the page on it.
- **Quota:** flight_search limits are much tighter than the data API. On-demand + per-IP rate-limit + budget guard are mandatory.
- **Signing:** the signature is fiddly (exact param order). Task 1 + a fixture test de-risk it.
- **Vercel 10s limit:** a single function can't hold a 30s poll — split into init + continuation polling (`pending` + `/results`).
- **Result mismatch:** even live-search may differ slightly from Aviasales at the final step; keep the "проверьте перед покупкой" disclaimer.

## Not in this plan
- Replacing the cached feed (it stays — it's the discovery layer; live-search is the confirmation layer).
- Caching live-search results (could add a short TTL cache later to dedupe repeat clicks).

Stop here. Run /gsd or your equivalent to execute once Task 1 research is done.
