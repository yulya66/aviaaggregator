# Plan 3 — L1 Saved Searches Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a logged-in user save specific routes to watch (origin → destination, date window, max price). A 6-hourly cron polls Travelpayouts for each saved search and, when the cheapest match is at/under the user's threshold, writes it into the shared `deals` feed (so it surfaces on the home page). A `/saved` page provides full CRUD.

**Architecture:** A new `saved_searches` table (RLS: owner-only). A new `pricesCheap` method on the existing Travelpayouts client (hitting `/v1/prices/cheap`), normalized to the same `TpLatestPrice` shape the L2/L3 code already uses, so the L1 runner reuses `toSnapshot`/`toDeal` and the `record_snapshots` RPC. `runPollL1(supabase, tp, marker)` reads saved searches, finds the cheapest in-window price per search, and upserts matches into `deals`. The existing `/api/cron/[job]` route dispatches `poll_l1`. `/saved` is an auth-gated RSC with server actions for create/delete. **No email in this plan** — `notify_email` is stored but unused until the Email plan.

**Tech Stack:** Next.js 15 (App Router, RSC, server actions), TypeScript, `@supabase/supabase-js` + `@supabase/ssr`, Postgres (RLS), Vitest. Travelpayouts data API. GitHub Actions cron (cron-l1 already scaffolded).

**Spec reference:** `docs/superpowers/specs/2026-05-21-aviaaggregator-design.md` (§2.1 saved_searches, §3.2 L1 algorithm, §4.6 /saved). **Deferred to the Email plan:** the `notify_email`/`mailer.send` branch of §3.2, anti-spam, `/settings`, Resend webhook.

---

## Context from Plans 1–2 (already on disk — do not recreate)

- `src/lib/supabase/server.ts` — `createClient()` (RSC/anon, respects RLS) and `createServiceRoleClient()` (cron, bypasses RLS).
- `src/lib/tp/client.ts` — exports `pricesLatest`, `TpLatestPrice`, `PricesLatestParams`, `TpClient` interface, and the `tpClient` singleton. This plan ADDS `pricesCheap` + a `TpCheapClient` interface to the same file without breaking L2/L3 (which use only `TpClient`).
- `src/lib/jobs/shared.ts` — `toSnapshot`, `toDeal`, `SnapshotRow`, `DealRow`, `dedupeCheapest`, deterministic ids. L1 reuses `toSnapshot`/`toDeal`.
- `src/app/api/cron/[job]/route.ts` — dispatches `poll_l2`/`poll_l3`, records `cron_runs`, returns 501 for the rest. This plan adds the `poll_l1` branch.
- `supabase/migrations/20260521000001_initial.sql` (profiles) and `20260604000001_l2_l3_core.sql` (deals, price_snapshots, anomalies, cron_runs, RPCs). New migration is additive.
- `src/components/nav.tsx` — auth-aware nav with `/anomalies` and `/status` links. This plan adds a `/saved` link.
- Tests: Vitest. Job runners are tested with hand-rolled fakes cast `as unknown as SupabaseClient`; never live DB/TP (spec §6.4 "No-prod-API rule").
- **Docker may be unavailable** in this environment. If `supabase db reset` can't connect, commit the migration and let it apply on cloud `supabase db push`; all non-migration tasks mock the DB and need no Docker.

---

## File structure after this plan

```
supabase/migrations/
  20260605000001_l1_saved_searches.sql   # saved_searches table + owner RLS
src/lib/tp/
  client.ts                              # MODIFY — add pricesCheap + TpCheapClient
  client.test.ts                         # MODIFY — add pricesCheap tests
src/lib/jobs/
  l1.ts                                  # NEW — runPollL1
  l1.test.ts                             # NEW
src/app/
  api/cron/[job]/route.ts                # MODIFY — dispatch poll_l1
  api/cron/[job]/route.test.ts           # MODIFY — add poll_l1 case
  saved/
    page.tsx                             # NEW — auth-gated CRUD list + form
    actions.ts                           # NEW — createSavedSearch / deleteSavedSearch
src/components/
  nav.tsx                                # MODIFY — add /saved link
.github/workflows/cron-l1.yml            # MODIFY — uncomment schedule
```

---

## Task 1: Migration — `saved_searches` table

**Files:**
- Create: `supabase/migrations/20260605000001_l1_saved_searches.sql`

- [ ] **Step 1: Create the migration file with EXACTLY this content**

```sql
-- 20260605000001_l1_saved_searches.sql
-- L1: per-user saved searches (tracked routes with a price threshold). Owner-only RLS.

create table public.saved_searches (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  origin_iata      text        not null,
  destination_iata text,        -- null = "anywhere" (not yet polled in this plan; see runPollL1)
  date_from        date        not null,
  date_to          date        not null,
  max_price_rub    int         not null,
  notify_email     boolean     not null default false, -- stored now; used by the Email plan
  created_at       timestamptz not null default now()
);

create index saved_searches_user_idx on public.saved_searches (user_id);

alter table public.saved_searches enable row level security;

create policy "saved_searches_select_own"
  on public.saved_searches for select using (auth.uid() = user_id);

create policy "saved_searches_insert_own"
  on public.saved_searches for insert with check (auth.uid() = user_id);

create policy "saved_searches_update_own"
  on public.saved_searches for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "saved_searches_delete_own"
  on public.saved_searches for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Apply locally if Docker is available**

```powershell
pnpm dlx supabase db reset
```
Expected: `Finished supabase db reset`. **If Docker is unavailable**, skip — commit and apply on cloud later (the migration is additive). Do not treat missing Docker as a failure.

- [ ] **Step 3: Commit**

```powershell
git add "supabase/migrations/20260605000001_l1_saved_searches.sql"
git commit -m "feat(db): saved_searches table with owner RLS (L1)"
```

---

## Task 2: Add `pricesCheap` to the Travelpayouts client (TDD)

**Files:**
- Modify: `src/lib/tp/client.ts`
- Modify: `src/lib/tp/client.test.ts`

`/v1/prices/cheap` returns a nested object keyed by destination; we flatten it to the same `TpLatestPrice[]` shape the rest of the code already consumes. A separate `TpCheapClient` interface keeps L2/L3 (which use `TpClient`) untouched.

- [ ] **Step 1: Append these tests to `src/lib/tp/client.test.ts`**

Add this `describe` block at the end of the file (keep the existing `pricesLatest` tests and the existing imports; update the import line to also import `pricesCheap`):

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pricesCheap, pricesLatest } from "./client";
```

```typescript
describe("pricesCheap", () => {
  it("flattens the nested /v1/prices/cheap response into TpLatestPrice[]", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      {
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              AER: {
                "0": {
                  price: 4200,
                  airline: "U6",
                  departure_at: "2026-09-10T08:00:00Z",
                  return_at: null,
                  number_of_changes: 0,
                },
              },
            },
          }),
      } as unknown as Response,
    );

    const result = await pricesCheap({ origin: "EKB", destination: "AER", departDate: "2026-09" });

    expect(result).toEqual([
      {
        origin: "EKB",
        destination: "AER",
        depart_date: "2026-09-10",
        return_date: null,
        value: 4200,
        airline: "U6",
        number_of_changes: 0,
      },
    ]);

    const calledUrl = String(spy.mock.calls[0][0]);
    expect(calledUrl).toContain("/v1/prices/cheap");
    expect(calledUrl).toContain("origin=EKB");
    expect(calledUrl).toContain("destination=AER");
    expect(calledUrl).toContain("depart_date=2026-09");
    expect(calledUrl).toContain("currency=rub");
    expect(calledUrl).toContain("token=test-token");
  });

  it("returns an empty array when there is no data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      { ok: true, status: 200, json: () => Promise.resolve({ success: true }) } as unknown as Response,
    );
    const result = await pricesCheap({ origin: "MOW", destination: "IST", departDate: "2026-10" });
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, confirm the new tests FAIL (pricesCheap not exported):**

```powershell
pnpm test src/lib/tp/client.test.ts
```

- [ ] **Step 3: Edit `src/lib/tp/client.ts`** — add the cheap-endpoint types, the `pricesCheap` function, the `TpCheapClient` interface, and widen the `tpClient` singleton. Make these additions:

After the existing `PricesLatestParams` type, add:

```typescript
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
```

Then change the bottom of the file from:

```typescript
/** Injectable interface so job runners can be unit-tested without network. */
export type TpClient = {
  pricesLatest(params: PricesLatestParams): Promise<TpLatestPrice[]>;
};

export const tpClient: TpClient = { pricesLatest };
```

to:

```typescript
/** Injectable interfaces so job runners can be unit-tested without network. */
export type TpClient = {
  pricesLatest(params: PricesLatestParams): Promise<TpLatestPrice[]>;
};

export type TpCheapClient = {
  pricesCheap(params: PricesCheapParams): Promise<TpLatestPrice[]>;
};

export const tpClient: TpClient & TpCheapClient = { pricesLatest, pricesCheap };
```

- [ ] **Step 4: Run, confirm PASS (existing 3 + new 2 = 5 passed):**

```powershell
pnpm test src/lib/tp/client.test.ts
```

- [ ] **Step 5: Lint + typecheck (use `pnpm lint:fix` if Biome flags formatting):**

```powershell
pnpm lint
pnpm typecheck
```

- [ ] **Step 6: Commit**

```powershell
git add "src/lib/tp/client.ts" "src/lib/tp/client.test.ts"
git commit -m "feat(tp): pricesCheap (/v1/prices/cheap) normalized to TpLatestPrice"
```

---

## Task 3: L1 runner (TDD)

**Files:**
- Create: `src/lib/jobs/l1.test.ts`
- Create: `src/lib/jobs/l1.ts`

The runner reads saved searches, queries `pricesCheap` per search, picks the cheapest price within `[date_from, date_to]`, and — if it's at/under `max_price_rub` — records a snapshot + upserts a deal. Searches with a null `destination_iata` ("anywhere") are skipped in this plan (the cheap endpoint needs a destination; "anywhere" L1 is a later enhancement).

- [ ] **Step 1: Write `src/lib/jobs/l1.test.ts` EXACTLY:**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { TpCheapClient, TpLatestPrice } from "@/lib/tp/client";
import { runPollL1 } from "./l1";

function price(partial: Partial<TpLatestPrice>): TpLatestPrice {
  return {
    origin: "EKB",
    destination: "AER",
    depart_date: "2026-09-10",
    return_date: null,
    value: 4200,
    airline: "U6",
    number_of_changes: 0,
    ...partial,
  };
}

function makeFakeDb(searches: unknown[]) {
  const select = vi.fn().mockResolvedValue({ data: searches, error: null });
  const rpc = vi.fn().mockResolvedValue({ error: null });
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn((table: string) => {
    if (table === "saved_searches") return { select };
    return { upsert }; // deals
  });
  const db = { from, rpc } as unknown as SupabaseClient;
  return { db, select, rpc, upsert, from };
}

const SEARCH = {
  id: "11111111-1111-1111-1111-111111111111",
  origin_iata: "EKB",
  destination_iata: "AER",
  date_from: "2026-09-01",
  date_to: "2026-09-30",
  max_price_rub: 5000,
};

describe("runPollL1", () => {
  it("records a deal when the cheapest in-window price is at/under the threshold", async () => {
    const { db, rpc, upsert } = makeFakeDb([SEARCH]);
    const tp: TpCheapClient = {
      pricesCheap: vi.fn().mockResolvedValue([
        price({ depart_date: "2026-09-10", value: 4200 }),
        price({ depart_date: "2026-09-15", value: 6000 }),
      ]),
    };

    const result = await runPollL1(db, tp, "555");

    expect(tp.pricesCheap).toHaveBeenCalledWith({
      origin: "EKB",
      destination: "AER",
      departDate: "2026-09",
    });
    expect(result.api_calls).toBe(1);
    expect(rpc).toHaveBeenCalledWith("record_snapshots", expect.objectContaining({ p_rows: expect.any(Array) }));
    expect(upsert).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ onConflict: "origin_iata,destination_iata,depart_date" }),
    );
    expect(result.rows_inserted).toBe(1);
  });

  it("inserts nothing when the cheapest in-window price exceeds the threshold", async () => {
    const { db, upsert } = makeFakeDb([SEARCH]);
    const tp: TpCheapClient = {
      pricesCheap: vi.fn().mockResolvedValue([price({ depart_date: "2026-09-10", value: 8000 })]),
    };

    const result = await runPollL1(db, tp, "555");

    expect(result.rows_inserted).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("ignores prices outside the date window", async () => {
    const { db, upsert } = makeFakeDb([SEARCH]);
    const tp: TpCheapClient = {
      pricesCheap: vi.fn().mockResolvedValue([price({ depart_date: "2026-10-05", value: 100 })]),
    };

    const result = await runPollL1(db, tp, "555");

    expect(result.rows_inserted).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("skips saved searches with a null destination (anywhere)", async () => {
    const { db } = makeFakeDb([{ ...SEARCH, destination_iata: null }]);
    const tp: TpCheapClient = { pricesCheap: vi.fn() };

    const result = await runPollL1(db, tp, "555");

    expect(tp.pricesCheap).not.toHaveBeenCalled();
    expect(result.api_calls).toBe(0);
    expect(result.rows_inserted).toBe(0);
  });
});
```

- [ ] **Step 2: Run, confirm FAIL (Cannot find module './l1'):**

```powershell
pnpm test src/lib/jobs/l1.test.ts
```

- [ ] **Step 3: Implement `src/lib/jobs/l1.ts` EXACTLY:**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TpCheapClient, TpLatestPrice } from "@/lib/tp/client";
import { type DealRow, type SnapshotRow, toDeal, toSnapshot } from "./shared";

export type SavedSearch = {
  id: string;
  origin_iata: string;
  destination_iata: string | null;
  date_from: string; // YYYY-MM-DD
  date_to: string; // YYYY-MM-DD
  max_price_rub: number;
};

export type JobResult = { api_calls: number; rows_inserted: number };

function cheapestInWindow(
  prices: TpLatestPrice[],
  from: string,
  to: string,
): TpLatestPrice | undefined {
  let best: TpLatestPrice | undefined;
  for (const p of prices) {
    if (p.depart_date < from || p.depart_date > to) continue;
    if (!best || p.value < best.value) best = p;
  }
  return best;
}

export async function runPollL1(
  supabase: SupabaseClient,
  tp: TpCheapClient,
  marker: string,
): Promise<JobResult> {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("saved_searches")
    .select("id, origin_iata, destination_iata, date_from, date_to, max_price_rub");
  if (error) throw new Error(`saved_searches read failed: ${JSON.stringify(error)}`);
  const searches = (data ?? []) as SavedSearch[];

  let apiCalls = 0;
  const snapshots: SnapshotRow[] = [];
  const deals: DealRow[] = [];

  for (const s of searches) {
    if (!s.destination_iata) continue; // "anywhere" not polled in this plan

    const departMonth = s.date_from.slice(0, 7); // YYYY-MM
    const results = await tp.pricesCheap({
      origin: s.origin_iata,
      destination: s.destination_iata,
      departDate: departMonth,
    });
    apiCalls++;

    const cheapest = cheapestInWindow(results, s.date_from, s.date_to);
    if (cheapest && cheapest.value <= s.max_price_rub) {
      snapshots.push(toSnapshot(s.origin_iata, cheapest));
      deals.push(toDeal(s.origin_iata, cheapest, marker, nowIso));
    }
  }

  if (snapshots.length > 0) {
    const { error: snapErr } = await supabase.rpc("record_snapshots", { p_rows: snapshots });
    if (snapErr) throw new Error(`record_snapshots failed: ${JSON.stringify(snapErr)}`);
  }
  if (deals.length > 0) {
    const { error: dealErr } = await supabase
      .from("deals")
      .upsert(deals, { onConflict: "origin_iata,destination_iata,depart_date" });
    if (dealErr) throw new Error(`deals upsert failed: ${JSON.stringify(dealErr)}`);
  }

  return { api_calls: apiCalls, rows_inserted: deals.length };
}
```

- [ ] **Step 4: Run, confirm PASS (4 passed):**

```powershell
pnpm test src/lib/jobs/l1.test.ts
```

- [ ] **Step 5: Lint + typecheck (use `pnpm lint:fix` if Biome flags formatting):**

```powershell
pnpm lint
pnpm typecheck
```

- [ ] **Step 6: Commit**

```powershell
git add "src/lib/jobs/l1.ts" "src/lib/jobs/l1.test.ts"
git commit -m "feat(l1): saved-search runner populating the deals feed"
```

---

## Task 4: Wire `poll_l1` into the cron route (TDD)

**Files:**
- Modify: `src/app/api/cron/[job]/route.ts`
- Modify: `src/app/api/cron/[job]/route.test.ts`

- [ ] **Step 1: Add an l1 mock + a poll_l1 test to `src/app/api/cron/[job]/route.test.ts`**

Add this mock next to the existing `vi.mock("@/lib/jobs/l2", ...)` block:

```typescript
vi.mock("@/lib/jobs/l1", () => ({
  runPollL1: vi.fn().mockResolvedValue({ api_calls: 2, rows_inserted: 1 }),
}));
```

And add this test inside the `describe("POST /api/cron/[job]", ...)` block:

```typescript
  it("runs poll_l1 and returns 200 with the job result", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest("secret-token", "poll_l1"), {
      params: Promise.resolve({ job: "poll_l1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.job).toBe("poll_l1");
    expect(body.rows_inserted).toBe(1);
  });
```

- [ ] **Step 2: Run, confirm the new poll_l1 case FAILS (currently 501):**

```powershell
pnpm test src/app/api/cron
```

- [ ] **Step 3: Edit `src/app/api/cron/[job]/route.ts`** — import the L1 runner and add `poll_l1` to the implemented branch.

Add the import near the other job imports:

```typescript
import { runPollL1 } from "@/lib/jobs/l1";
```

Change the condition and dispatch. Replace:

```typescript
  if (job === "poll_l2" || job === "poll_l3") {
    const supabase = createServiceRoleClient();
    const marker = process.env.TP_PARTNER_MARKER ?? "";
    const startedAt = new Date().toISOString();
    try {
      const result =
        job === "poll_l2"
          ? await runPollL2(supabase, tpClient, marker)
          : await runPollL3(supabase, tpClient, marker, new Date().getUTCHours());
```

with:

```typescript
  if (job === "poll_l1" || job === "poll_l2" || job === "poll_l3") {
    const supabase = createServiceRoleClient();
    const marker = process.env.TP_PARTNER_MARKER ?? "";
    const startedAt = new Date().toISOString();
    try {
      let result: { api_calls: number; rows_inserted: number };
      if (job === "poll_l1") {
        result = await runPollL1(supabase, tpClient, marker);
      } else if (job === "poll_l2") {
        result = await runPollL2(supabase, tpClient, marker);
      } else {
        result = await runPollL3(supabase, tpClient, marker, new Date().getUTCHours());
      }
```

(The rest of the `try` block — the `cron_runs` insert, the `return NextResponse.json({ job, ...result })`, and the `catch` — stays exactly as is. Note `runPollL3`'s result has an extra `anomalies_detected` key; assigning it to the `{api_calls, rows_inserted}`-typed `result` is fine because the extra key is structurally compatible and the spread keeps it in the JSON response.)

- [ ] **Step 4: Run, confirm PASS (7 passed):**

```powershell
pnpm test src/app/api/cron
```

- [ ] **Step 5: Lint + typecheck (use `pnpm lint:fix` if Biome flags formatting):**

```powershell
pnpm lint
pnpm typecheck
```

- [ ] **Step 6: Commit**

```powershell
git add "src/app/api/cron/[job]/route.ts" "src/app/api/cron/[job]/route.test.ts"
git commit -m "feat(cron): dispatch poll_l1 to the saved-search runner"
```

---

## Task 5: `/saved` page with create/delete server actions

**Files:**
- Create: `src/app/saved/actions.ts`
- Create: `src/app/saved/page.tsx`

Auth-gated. Logged-out users are redirected to `/auth/login`. RLS guarantees a user only ever sees/edits their own rows; the actions additionally pass `user_id` from the authenticated session. UI only — verify via lint + typecheck.

- [ ] **Step 1: Create `src/app/saved/actions.ts` EXACTLY:**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SavedSearchInput = {
  origin_iata: string;
  destination_iata: string;
  date_from: string;
  date_to: string;
  max_price_rub: number;
};

export async function createSavedSearch(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const origin = String(formData.get("origin_iata") ?? "").trim().toUpperCase();
  const destination = String(formData.get("destination_iata") ?? "").trim().toUpperCase();
  const dateFrom = String(formData.get("date_from") ?? "");
  const dateTo = String(formData.get("date_to") ?? "");
  const maxPrice = Number(formData.get("max_price_rub") ?? 0);

  if (!origin || !destination || !dateFrom || !dateTo || maxPrice <= 0) return;

  await supabase.from("saved_searches").insert({
    user_id: user.id,
    origin_iata: origin,
    destination_iata: destination,
    date_from: dateFrom,
    date_to: dateTo,
    max_price_rub: maxPrice,
  });

  revalidatePath("/saved");
}

export async function deleteSavedSearch(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // RLS also enforces ownership; the explicit user_id filter is defense-in-depth.
  await supabase.from("saved_searches").delete().eq("id", id).eq("user_id", user.id);

  revalidatePath("/saved");
}
```

- [ ] **Step 2: Create `src/app/saved/page.tsx` EXACTLY:**

```tsx
import { redirect } from "next/navigation";
import { createSavedSearch, deleteSavedSearch } from "./actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const RUB = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });

export default async function SavedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data, error } = await supabase
    .from("saved_searches")
    .select("id, origin_iata, destination_iata, date_from, date_to, max_price_rub")
    .order("created_at", { ascending: false });

  const rows = error ? [] : (data ?? []);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold">Мои поиски</h1>
      <p className="mt-2 text-gray-600">
        Отслеживаемые маршруты. Cron проверяет их каждые 6 часов и кладёт совпадения в общую ленту.
      </p>

      <form action={createSavedSearch} className="mt-6 grid grid-cols-2 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-3">
        <input name="origin_iata" required placeholder="Откуда (EKB)" maxLength={3} className="rounded border border-gray-300 px-3 py-2 uppercase" />
        <input name="destination_iata" required placeholder="Куда (AER)" maxLength={3} className="rounded border border-gray-300 px-3 py-2 uppercase" />
        <input name="max_price_rub" required type="number" min={1} placeholder="Макс. цена ₽" className="rounded border border-gray-300 px-3 py-2" />
        <label className="flex flex-col text-xs text-gray-600">
          С даты
          <input name="date_from" required type="date" className="rounded border border-gray-300 px-3 py-2" />
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          По дату
          <input name="date_to" required type="date" className="rounded border border-gray-300 px-3 py-2" />
        </label>
        <button type="submit" className="self-end rounded bg-black px-4 py-2 text-white hover:bg-gray-800">
          Добавить
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="mt-8 text-gray-600">Пока нет сохранённых поисков. Добавьте первый выше.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {rows.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded border border-gray-200 px-4 py-3"
            >
              <div>
                <span className="font-semibold">
                  {s.origin_iata} → {s.destination_iata ?? "куда угодно"}
                </span>
                <p className="mt-1 text-sm text-gray-600">
                  {s.date_from} … {s.date_to} · до {RUB.format(s.max_price_rub)}
                </p>
              </div>
              <form action={deleteSavedSearch}>
                <input type="hidden" name="id" value={s.id} />
                <button type="submit" className="text-sm text-gray-500 hover:text-red-700">
                  Удалить
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Lint + typecheck (use `pnpm lint:fix` if Biome flags formatting):**

```powershell
pnpm lint
pnpm typecheck
```
Both clean. (Supabase rows are loosely typed → `.map((s) => ...)` may infer `any`; acceptable, consistent with the codebase.)

- [ ] **Step 4: Commit**

```powershell
git add "src/app/saved/actions.ts" "src/app/saved/page.tsx"
git commit -m "feat(ui): /saved page with create/delete saved searches"
```

---

## Task 6: Nav link to `/saved` + enable the L1 cron schedule

**Files:**
- Modify: `src/components/nav.tsx`
- Modify: `.github/workflows/cron-l1.yml`

- [ ] **Step 1: Add a `/saved` link in `src/components/nav.tsx`**

The nav currently renders, for a logged-in user, their email + a logout form. Add a "Мои поиски" link visible only when logged in. Find this block:

```tsx
          {user ? (
            <>
              <span className="text-gray-600">{user.email}</span>
              <form action="/auth/logout" method="post">
                <button type="submit" className="text-gray-600 hover:text-black">
                  Выход
                </button>
              </form>
            </>
          ) : (
```

and change it to:

```tsx
          {user ? (
            <>
              <Link href="/saved" className="text-gray-600 hover:text-black">
                Мои поиски
              </Link>
              <span className="text-gray-600">{user.email}</span>
              <form action="/auth/logout" method="post">
                <button type="submit" className="text-gray-600 hover:text-black">
                  Выход
                </button>
              </form>
            </>
          ) : (
```

(`Link` is already imported in nav.tsx. Do not touch the `/anomalies` or `/status` links.)

- [ ] **Step 2: Uncomment the schedule in `.github/workflows/cron-l1.yml`**

Change the `on:` block from:

```yaml
on:
  # schedule:
  #   - cron: "0 */6 * * *"   # 4x/day: 00:00, 06:00, 12:00, 18:00 UTC — uncomment in Plan 3
  workflow_dispatch:
```

to:

```yaml
on:
  schedule:
    - cron: "0 */6 * * *"   # 4x/day: 00:00, 06:00, 12:00, 18:00 UTC
  workflow_dispatch:
```

- [ ] **Step 3: Lint + typecheck:**

```powershell
pnpm lint
pnpm typecheck
```
Both clean. (If a stale local `.next/types` makes typecheck complain about `/saved`, delete `.next` and re-run — a fresh run passes.)

- [ ] **Step 4: Commit**

```powershell
git add "src/components/nav.tsx" ".github/workflows/cron-l1.yml"
git commit -m "feat(ui): nav link to /saved; enable L1 cron schedule (6h)"
```

---

## Task 7: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Fresh CI-order gate (delete .next to mimic a clean checkout)**

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
pnpm lint
pnpm typecheck
pnpm test
```
Expected: lint clean, typecheck clean, all tests pass (Plan 2's 39 + the new pricesCheap (2) + L1 runner (4) + the poll_l1 route case (1) = 46).

- [ ] **Step 2: Production build with CI-style env**

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL="https://ci.supabase.co"; $env:NEXT_PUBLIC_SUPABASE_ANON_KEY="ci-anon"; $env:SUPABASE_SERVICE_ROLE_KEY="ci-service"; $env:CRON_BEARER_TOKEN="ci-cron-token"; pnpm build
```
Expected: build succeeds; `/saved` appears as a dynamic (`ƒ`) route alongside the existing pages.

- [ ] **Step 3: Local smoke (only if Docker is available)**

```powershell
pnpm dlx supabase start
pnpm dlx supabase db reset
pnpm dev
```
Log in via magic link (Inbucket at `http://127.0.0.1:54324`), open `/saved`, add a search, confirm it lists and deletes. Then:
```powershell
$env:TP_API_KEY="<token>"
curl --fail-with-body -X POST -H "Authorization: Bearer local-dev-token-for-cron" http://localhost:3000/api/cron/poll_l1
```
Expected: HTTP 200 `{"job":"poll_l1","api_calls":...,"rows_inserted":...}`. **If Docker/TP unavailable, skip** — steps 1–2 validate the code.

- [ ] **Step 4: Final commit only if generated files changed (otherwise skip)**

```powershell
git status
```

---

## Plan 3 completion criteria

- [ ] `saved_searches` table with owner-only RLS (select/insert/update/delete).
- [ ] `pricesCheap` added to the TP client (own `TpCheapClient` interface; L2/L3 untouched), unit-tested.
- [ ] `runPollL1` reads saved searches, finds the cheapest in-window match, upserts qualifying deals; unit-tested incl. threshold, window, and null-destination skip.
- [ ] `POST /api/cron/poll_l1` returns 200 and records `cron_runs`; L1 cron schedule enabled.
- [ ] `/saved` page: auth-gated, lists/creates/deletes saved searches.
- [ ] Nav shows "Мои поиски" for logged-in users.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all pass.

**Not in Plan 3 (deferred to the Email plan):** `notify_email` delivery, Resend mailer + anti-spam + templates, L1-hit & L3-anomaly emails, `/settings` opt-in page, Resend webhook. Also deferred: `dismissed_deals`, "anywhere" (null-destination) L1 polling.

**Deploy-side (user, manual):** apply the new migration to Supabase Cloud (`supabase db push`).

Stop here. Once Plan 3 is green, the next plan is Email/notifications.
