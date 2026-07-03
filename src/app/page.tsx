import Link from "next/link";
import { CityAutocomplete } from "@/components/city-autocomplete";
import { DateRange } from "@/components/date-range";
import { DealFeed, type FeedCard } from "@/components/deal-feed";
import { RouteDateControls } from "@/components/route-date-controls";
import { TpWidget } from "@/components/tp-widget";
import {
  cityCountryName,
  cityName,
  countryName,
  countryNameGenitive,
  isDomestic,
} from "@/data/airports";
import { ALL_HUB_CODES, HOME_HUB_CODES, ORIGIN_OPTIONS, POPULAR_DESTINATIONS } from "@/data/hubs";
import { buildAviasalesLink } from "@/lib/affiliate";
import { formatDate } from "@/lib/format";
import { dealId } from "@/lib/jobs/shared";
import { createClient } from "@/lib/supabase/server";
import { pricesCalendar, pricesLatest, pricesRoundTrip, type TpLatestPrice } from "@/lib/tp/client";

export const dynamic = "force-dynamic";

const DEAL_COLS =
  "id, origin_iata, destination_iata, depart_date, price_rub, airline, transfers, deep_link, last_seen_at";

type DealRowDb = {
  id: string;
  origin_iata: string;
  destination_iata: string;
  depart_date: string;
  price_rub: number;
  airline: string | null;
  transfers: number;
  deep_link: string;
  last_seen_at?: string | null;
  discount_pct?: number;
};

/** "2026-06-07T14:00:00Z" → "цена от 07.06" */
function priceNoteFrom(seenAt: string | null | undefined): string | undefined {
  if (!seenAt) return undefined;
  const [, m, d] = seenAt.slice(0, 10).split("-");
  return `цена от ${d}.${m}`;
}

const inputCls =
  "rounded-lg border border-line bg-paper px-3 py-2 font-mono text-sm text-ink outline-none focus:border-accent";

/** ["2026-06-01", "2026-07-01", ...] — `count` month-starts beginning with `fromIso`'s month. */
function monthStarts(fromIso: string, count: number): string[] {
  const [y, m] = fromIso.split("-").map(Number);
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.UTC(y, m - 1 + i, 1)).toISOString().slice(0, 10),
  );
}

/** Inclusive count of calendar months spanned by [fromIso, toIso]. */
function monthSpan(fromIso: string, toIso: string): number {
  const [fy, fm] = fromIso.split("-").map(Number);
  const [ty, tm] = toIso.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}

function toCard(d: DealRowDb, prefix: string): FeedCard {
  return {
    key: `${prefix}-${d.id}`,
    origin: d.origin_iata,
    destination: d.destination_iata,
    route: `${cityName(d.origin_iata)} → ${cityName(d.destination_iata)}`,
    routeTitle: `${d.origin_iata} → ${d.destination_iata}`,
    dateLabel: formatDate(d.depart_date),
    departDate: d.depart_date,
    priceRub: d.price_rub,
    airline: d.airline,
    transfers: d.transfers,
    deepLink: d.deep_link,
    priceNote: priceNoteFrom(d.last_seen_at),
    regionNote: cityCountryName(d.destination_iata),
    abroad: !isDomestic(d.destination_iata),
    ...(d.discount_pct != null ? { badge: `−${Math.round(Number(d.discount_pct))}%` } : {}),
  };
}

type SearchState = {
  mode?: string;
  from?: string;
  to?: string;
  origin?: string;
  dest?: string;
  trip?: string;
};

/** Params carried between tabs so each tab's entered search survives a switch (item 6). */
function tabQuery(sp: SearchState, mode?: "route"): Record<string, string> {
  const q: Record<string, string> = {};
  if (sp.origin) q.origin = sp.origin;
  if (sp.dest) q.dest = sp.dest;
  if (sp.from) q.from = sp.from;
  if (sp.to) q.to = sp.to;
  if (sp.trip) q.trip = sp.trip;
  if (mode) q.mode = mode;
  return q;
}

function Tabs({ active, sp }: { active: "feed" | "route"; sp: SearchState }) {
  const base =
    "rounded-full px-4 py-2 font-mono text-[0.7rem] uppercase tracking-[0.14em] transition";
  const on = "bg-ink text-card";
  const off = "border border-line text-muted hover:border-ink hover:text-ink";
  return (
    <div className="mt-6 flex gap-2">
      <Link
        href={{ pathname: "/", query: tabQuery(sp) }}
        className={`${base} ${active === "feed" ? on : off}`}
      >
        Я хоть куда
      </Link>
      <Link
        href={{ pathname: "/", query: tabQuery(sp, "route") }}
        className={`${base} ${active === "route" ? on : off}`}
      >
        Я знаю куда хочу
      </Link>
    </div>
  );
}

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchState> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const from = sp.from || today;
  const to = sp.to || "";
  const mode = sp.mode === "route" ? "route" : "feed";

  // ── "Я знаю куда хочу" — specific origin → destination ──────────────────────
  if (mode === "route") {
    const origin = sp.origin || "";
    const dest = sp.dest || "";
    // «Куда» accepts a country: a 2-letter code is a country, 3 letters a city (spec 2026-06-19).
    const destIsCountry = dest.length === 2;
    // Round-trip mode (туда-обратно) — city→city with both dates, live TP (spec 2026-07-03).
    const isRound = sp.trip === "round";
    // Exact city→city route → date calendar; anything else → one cheapest fare per route.
    const exactRoute = Boolean(origin && dest) && !destIsCountry;
    let routeItems: FeedCard[] = [];
    if (origin || dest) {
      // One city is enough. Exact city→city → live calendar of dates for the route; one side
      // only → all flights from/into that city (prices/latest); a country → every city of that
      // country. City paths merge cached deals; country paths are live TP only (see below).
      const marker = process.env.TP_PARTNER_MARKER ?? "";
      const candidates: TpLatestPrice[] = [];
      const span = to ? Math.min(6, Math.max(1, monthSpan(from, to))) : 3;

      if (isRound) {
        // Round-trip — live TP only, a concrete city→city with both dates (spec 2026-07-03 v1).
        if (origin && dest && !destIsCountry && from && to) {
          try {
            candidates.push(
              ...(await pricesRoundTrip({
                origin,
                destination: dest,
                departDate: from,
                returnDate: to,
              })),
            );
          } catch {
            // no data — the empty state handles it
          }
        }
        // Otherwise leave empty; the empty state explains what round-trip needs.
      } else if (destIsCountry) {
        // Country destination — live TP only. DB deals store city codes, not countries, so the
        // cache can't be mixed in (spec 2026-06-19). With an origin it's a single call; without
        // one, fan out across our home hubs (top-50 cheapest each) rather than the whole planet.
        try {
          if (origin) {
            candidates.push(...(await pricesLatest({ origin, destination: dest, limit: 300 })));
          } else {
            const settled = await Promise.allSettled(
              HOME_HUB_CODES.map((hub) =>
                pricesLatest({ origin: hub, destination: dest, limit: 50 }),
              ),
            );
            for (const s of settled) {
              if (s.status === "fulfilled") candidates.push(...s.value);
            }
          }
        } catch {
          // no data — the empty state handles it
        }
      } else {
        let q = supabase
          .from("deals")
          .select(DEAL_COLS)
          .eq("is_active", true)
          .gte("depart_date", from);
        if (origin) q = q.eq("origin_iata", origin);
        if (dest) q = q.eq("destination_iata", dest);
        if (to) q = q.lte("depart_date", to);
        const dbRes = await q.limit(300);
        for (const d of (dbRes.data ?? []) as DealRowDb[]) {
          candidates.push({
            origin: d.origin_iata,
            destination: d.destination_iata,
            depart_date: d.depart_date,
            return_date: null,
            value: d.price_rub,
            airline: d.airline,
            number_of_changes: d.transfers,
          });
        }

        try {
          if (exactRoute) {
            const settled = await Promise.allSettled(
              monthStarts(from, span).map((month) =>
                pricesCalendar({ origin, destination: dest, month }),
              ),
            );
            for (const s of settled) {
              if (s.status === "fulfilled") candidates.push(...s.value);
            }
          } else {
            const latest = origin
              ? await pricesLatest({ origin, limit: 300 })
              : await pricesLatest({ destination: dest, limit: 300 });
            candidates.push(...latest);
          }
        } catch {
          // keep whatever the DB returned
        }
      }

      // The calendar returns ~a year of dates; without an explicit "По" cap the exact-route view
      // to the span window. One-sided/country search isn't capped (cheapest may be months out).
      const upperExclusive = exactRoute && !to ? monthStarts(from, span + 1)[span] : null;

      const best = new Map<string, TpLatestPrice>();
      for (const p of candidates) {
        if (!p.depart_date || p.depart_date < from) continue;
        if (to ? p.depart_date > to : upperExclusive && p.depart_date >= upperExclusive) continue;
        // Exact route → one entry per date; else → one per route (cheapest).
        const key = exactRoute ? p.depart_date : `${p.origin}_${p.destination}`;
        const cur = best.get(key);
        if (!cur || p.value < cur.value) best.set(key, p);
      }
      routeItems = [...best.values()]
        .sort((a, b) => a.value - b.value)
        .map((p) => {
          const id = dealId(p.origin, p);
          return {
            key: `route-${id}`,
            origin: p.origin,
            destination: p.destination,
            route: `${cityName(p.origin)} → ${cityName(p.destination)}`,
            routeTitle: `${p.origin} → ${p.destination}`,
            dateLabel: p.return_date
              ? `${formatDate(p.depart_date)} ↔ ${formatDate(p.return_date)}`
              : formatDate(p.depart_date),
            departDate: p.depart_date,
            priceRub: p.value,
            airline: p.airline,
            transfers: p.number_of_changes,
            priceNote: p.return_date ? "туда-обратно" : priceNoteFrom(today),
            regionNote: cityCountryName(p.destination),
            abroad: !isDomestic(p.destination),
            deepLink: buildAviasalesLink({
              origin: p.origin,
              destination: p.destination,
              departDate: p.depart_date,
              returnDate: p.return_date,
              marker,
              dealKind: "l2",
              dealId: id,
            }),
          } satisfies FeedCard;
        });
    }
    // Scale the slider to this route's real fares (Стамбул can exceed 50k) — no fixed cap.
    const routeCap = routeItems.length
      ? Math.max(5000, Math.ceil(Math.max(...routeItems.map((i) => i.priceRub)) / 1000) * 1000)
      : 50000;

    const emptyMsg = isRound
      ? destIsCountry
        ? `Для «туда-обратно» выберите город назначения, а не страну (${countryName(dest)}).`
        : !origin || !dest
          ? "Для «туда-обратно» укажите и «Откуда», и «Куда»."
          : !to
            ? "Для «туда-обратно» выберите даты — туда и обратно."
            : `Туда-обратно ${cityName(origin)} ↔ ${cityName(dest)} — пока нет находок. Попробуйте другие даты.`
      : `${
          destIsCountry
            ? origin
              ? `Из города ${cityName(origin)} в любой город ${countryNameGenitive(dest)}`
              : `В любой город ${countryNameGenitive(dest)}`
            : exactRoute
              ? `По маршруту ${cityName(origin)} → ${cityName(dest)}`
              : origin
                ? `Из города ${cityName(origin)}`
                : `В город ${cityName(dest)}`
        } пока нет находок. Попробуйте другие даты или режим «Я хоть куда».`;

    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="kicker">Поиск по маршруту</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          Куда летим?
        </h1>
        <Tabs active="route" sp={sp} />

        <form
          method="get"
          className="mt-6 grid grid-cols-2 gap-3 rounded-card border border-line bg-card p-4 sm:grid-cols-4"
        >
          <input type="hidden" name="mode" value="route" />
          <div className="col-span-1 flex flex-col gap-1 font-mono text-[0.62rem] uppercase tracking-wider text-muted">
            Откуда
            <CityAutocomplete
              name="origin"
              defaultCode={origin}
              defaultLabel={origin ? cityName(origin) : ""}
              placeholder="Ваш город"
              className={`${inputCls} w-full`}
              popular={ORIGIN_OPTIONS}
            />
          </div>
          <div className="col-span-1 flex flex-col gap-1 font-mono text-[0.62rem] uppercase tracking-wider text-muted">
            Куда
            <CityAutocomplete
              name="dest"
              defaultCode={dest}
              defaultLabel={dest ? (destIsCountry ? countryName(dest) : cityName(dest)) : ""}
              placeholder="Город или страна"
              className={`${inputCls} w-full`}
              popular={POPULAR_DESTINATIONS}
            />
          </div>
          <RouteDateControls
            defaultTrip={sp.trip || ""}
            defaultFrom={sp.from || ""}
            defaultTo={to}
            inputClassName={inputCls}
          />
          <button
            type="submit"
            className="col-span-2 rounded-lg bg-ink py-2 font-mono text-xs uppercase tracking-[0.18em] text-card transition hover:bg-accent sm:col-span-4"
          >
            Найти
          </button>
        </form>

        {!origin && !dest ? (
          <p className="mt-10 text-muted">
            Укажите хотя бы один город — «Откуда» или «Куда». Можно задать только один: например,
            только «Куда» — покажем рейсы туда откуда угодно.
          </p>
        ) : routeItems.length === 0 ? (
          <p className="mt-10 text-muted">{emptyMsg}</p>
        ) : (
          <DealFeed
            items={routeItems}
            showHubFilters={false}
            showAbroadFilter={false}
            priceCap={routeCap}
          />
        )}

        <TpWidget />
      </main>
    );
  }

  // ── "Я хоть куда" — discovery feed across all hubs ──────────────────────────
  const dealQueries = ALL_HUB_CODES.map((hub) => {
    let q = supabase.from("deals").select(DEAL_COLS).eq("is_active", true).gte("depart_date", from);
    if (to) q = q.lte("depart_date", to);
    return q
      .or(`origin_iata.eq.${hub},destination_iata.eq.${hub}`)
      .order("price_rub", { ascending: true })
      .limit(120);
  });
  // anomalies has detected_at instead of last_seen_at — alias it to match DealRowDb.
  let anomQ = supabase
    .from("anomalies")
    .select(
      "id, origin_iata, destination_iata, depart_date, price_rub, airline, transfers, deep_link, last_seen_at:detected_at, discount_pct",
    )
    .eq("is_active", true)
    .gte("depart_date", from);
  if (to) anomQ = anomQ.lte("depart_date", to);

  const [hubResults, anomaliesRes] = await Promise.all([
    Promise.all(dealQueries),
    anomQ.order("price_rub", { ascending: true }).limit(60),
  ]);

  if (hubResults.some((r) => r.error) || anomaliesRes.error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-3xl font-extrabold">Лента</h1>
        <p className="mt-4 text-muted">Не удалось загрузить, обновите через минуту.</p>
      </main>
    );
  }

  const dealsById = new Map<string, DealRowDb>();
  for (const res of hubResults) {
    for (const d of (res.data ?? []) as DealRowDb[]) dealsById.set(d.id, d);
  }

  const items: FeedCard[] = [
    ...[...dealsById.values()].map((d) => toCard(d, "deal")),
    ...((anomaliesRes.data ?? []) as DealRowDb[]).map((a) => toCard(a, "anomaly")),
  ].sort((x, y) => x.priceRub - y.priceRub);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="kicker">Рейсы из ваших городов</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold leading-[1.04] tracking-tight sm:text-5xl">
        Топ-цены
      </h1>
      <Tabs active="feed" sp={sp} />
      <p className="mt-4 max-w-md text-sm text-muted">
        Туда и обратно, по всем хабам. Выберите даты и двигайте ползунок, чтобы найти самое горячее.
      </p>

      <form
        method="get"
        className="mt-5 flex flex-wrap items-end gap-3 rounded-card border border-line bg-card p-4"
      >
        <DateRange defaultFrom={from} defaultTo={to} inputClassName={inputCls} />
        <button
          type="submit"
          className="rounded-lg bg-ink px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-card transition hover:bg-accent"
        >
          Показать
        </button>
        {(sp.from || sp.to) && (
          <a
            href="/"
            className="self-center font-mono text-[0.7rem] uppercase tracking-wider text-accent hover:underline"
          >
            сброс
          </a>
        )}
      </form>

      {items.length === 0 ? (
        <p className="mt-10 text-muted">
          Нет рейсов в этом диапазоне дат. Расширьте даты или сбросьте фильтр.
        </p>
      ) : (
        <DealFeed items={items} />
      )}
    </main>
  );
}
