import Link from "next/link";
import { CityAutocomplete } from "@/components/city-autocomplete";
import { DealFeed, type FeedCard } from "@/components/deal-feed";
import { cityName } from "@/data/airports";
import { ALL_HUB_CODES, ORIGIN_OPTIONS, POPULAR_DESTINATIONS } from "@/data/hubs";
import { buildAviasalesLink } from "@/lib/affiliate";
import { formatDate } from "@/lib/format";
import { dealId } from "@/lib/jobs/shared";
import { createClient } from "@/lib/supabase/server";
import { pricesCalendar, pricesCalendarRaw, type TpLatestPrice } from "@/lib/tp/client";

export const dynamic = "force-dynamic";

const DEAL_COLS =
  "id, origin_iata, destination_iata, depart_date, price_rub, airline, transfers, deep_link";

type DealRowDb = {
  id: string;
  origin_iata: string;
  destination_iata: string;
  depart_date: string;
  price_rub: number;
  airline: string | null;
  transfers: number;
  deep_link: string;
  discount_pct?: number;
};

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
    priceRub: d.price_rub,
    airline: d.airline,
    transfers: d.transfers,
    deepLink: d.deep_link,
    ...(d.discount_pct != null ? { badge: `−${Math.round(Number(d.discount_pct))}%` } : {}),
  };
}

function Tabs({ active }: { active: "feed" | "route" }) {
  const base =
    "rounded-full px-4 py-2 font-mono text-[0.7rem] uppercase tracking-[0.14em] transition";
  const on = "bg-ink text-card";
  const off = "border border-line text-muted hover:border-ink hover:text-ink";
  return (
    <div className="mt-6 flex gap-2">
      <Link href="/" className={`${base} ${active === "feed" ? on : off}`}>
        Я хоть куда
      </Link>
      <Link href="/?mode=route" className={`${base} ${active === "route" ? on : off}`}>
        Я знаю куда хочу
      </Link>
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string;
    from?: string;
    to?: string;
    origin?: string;
    dest?: string;
    debug?: string;
  }>;
}) {
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
    let routeItems: FeedCard[] = [];
    if (origin && dest) {
      // prices/latest stores only one cheapest fare per route, so for a specific route we
      // pull a live calendar of dates from TP (cheapest per day) AND merge in whatever the
      // feed already cached for this route — so the tab is never empty when data exists.
      const marker = process.env.TP_PARTNER_MARKER ?? "";
      const candidates: TpLatestPrice[] = [];

      let q = supabase
        .from("deals")
        .select(DEAL_COLS)
        .eq("is_active", true)
        .eq("origin_iata", origin)
        .eq("destination_iata", dest)
        .gte("depart_date", from);
      if (to) q = q.lte("depart_date", to);
      const dbRes = await q.limit(200);
      for (const d of (dbRes.data ?? []) as DealRowDb[]) {
        candidates.push({
          origin,
          destination: dest,
          depart_date: d.depart_date,
          return_date: null,
          value: d.price_rub,
          airline: d.airline,
          number_of_changes: d.transfers,
        });
      }

      const span = to ? Math.min(6, Math.max(1, monthSpan(from, to))) : 3;
      const settled = await Promise.allSettled(
        monthStarts(from, span).map((month) =>
          pricesCalendar({ origin, destination: dest, month }),
        ),
      );
      for (const s of settled) {
        if (s.status === "fulfilled") candidates.push(...s.value);
      }

      const best = new Map<string, TpLatestPrice>();
      for (const p of candidates) {
        if (!p.depart_date || p.depart_date < from) continue;
        if (to && p.depart_date > to) continue;
        const cur = best.get(p.depart_date);
        if (!cur || p.value < cur.value) best.set(p.depart_date, p);
      }
      routeItems = [...best.values()]
        .sort((a, b) => a.value - b.value)
        .map((p) => {
          const id = dealId(origin, p);
          return {
            key: `route-${id}`,
            origin,
            destination: dest,
            route: `${cityName(origin)} → ${cityName(dest)}`,
            routeTitle: `${origin} → ${dest}`,
            dateLabel: formatDate(p.depart_date),
            priceRub: p.value,
            airline: p.airline,
            transfers: p.number_of_changes,
            deepLink: buildAviasalesLink({
              origin,
              destination: dest,
              departDate: p.depart_date,
              returnDate: null,
              marker,
              dealKind: "l2",
              dealId: id,
            }),
          } satisfies FeedCard;
        });
    }
    const routeCap = routeItems.length
      ? Math.min(
          50000,
          Math.max(5000, Math.ceil(Math.max(...routeItems.map((i) => i.priceRub)) / 1000) * 1000),
        )
      : 50000;

    // TEMP: ?debug=1 dumps the raw TP calendar response to diagnose empty routes.
    let debugDump = "";
    if (sp.debug === "1" && origin && dest) {
      try {
        const raw = await pricesCalendarRaw({
          origin,
          destination: dest,
          month: monthStarts(from, 1)[0],
        });
        debugDump = `month=${monthStarts(from, 1)[0].slice(0, 7)} items=${routeItems.length}\n${JSON.stringify(raw, null, 2)}`;
      } catch (e) {
        debugDump = `ERROR: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="kicker">Поиск по маршруту</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          Куда летим?
        </h1>
        <Tabs active="route" />

        <form
          method="get"
          className="mt-6 grid grid-cols-2 gap-3 rounded-card border border-line bg-card p-4 sm:grid-cols-4"
        >
          <input type="hidden" name="mode" value="route" />
          <label className="col-span-1 flex flex-col gap-1 font-mono text-[0.62rem] uppercase tracking-wider text-muted">
            Откуда
            <select name="origin" defaultValue={origin} className={inputCls}>
              <option value="">—</option>
              {ORIGIN_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="col-span-1 flex flex-col gap-1 font-mono text-[0.62rem] uppercase tracking-wider text-muted">
            Куда
            <CityAutocomplete
              name="dest"
              defaultCode={dest}
              defaultLabel={dest ? cityName(dest) : ""}
              placeholder="Город или страна"
              className={`${inputCls} w-full`}
              popular={POPULAR_DESTINATIONS}
            />
          </div>
          <label className="flex flex-col gap-1 font-mono text-[0.62rem] uppercase tracking-wider text-muted">
            Вылет с
            <input type="date" name="from" defaultValue={sp.from || ""} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 font-mono text-[0.62rem] uppercase tracking-wider text-muted">
            По
            <input type="date" name="to" defaultValue={to} className={inputCls} />
          </label>
          <button
            type="submit"
            className="col-span-2 rounded-lg bg-ink py-2 font-mono text-xs uppercase tracking-[0.18em] text-card transition hover:bg-accent sm:col-span-4"
          >
            Найти
          </button>
        </form>

        {debugDump && (
          <pre className="mt-6 max-h-96 overflow-auto rounded-lg border border-line bg-card p-3 text-[0.7rem] text-ink">
            {debugDump}
          </pre>
        )}

        {!origin || !dest ? (
          <p className="mt-10 text-muted">Выберите города отправления и прибытия.</p>
        ) : routeItems.length === 0 ? (
          <p className="mt-10 text-muted">
            По маршруту {cityName(origin)} → {cityName(dest)} пока нет находок. Попробуйте другие
            даты или режим «Я хоть куда».
          </p>
        ) : (
          <DealFeed items={routeItems} showHubFilters={false} priceCap={routeCap} />
        )}
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
      .limit(70);
  });
  let anomQ = supabase
    .from("anomalies")
    .select(`${DEAL_COLS}, discount_pct`)
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
        Дешёвые рейсы
      </h1>
      <Tabs active="feed" />
      <p className="mt-4 max-w-md text-sm text-muted">
        Туда и обратно, по всем хабам. Выберите даты и двигайте ползунок, чтобы найти самое горячее.
      </p>

      <form
        method="get"
        className="mt-5 flex flex-wrap items-end gap-3 rounded-card border border-line bg-card p-4"
      >
        <label className="flex flex-col gap-1 font-mono text-[0.62rem] uppercase tracking-wider text-muted">
          Вылет с
          <input type="date" name="from" defaultValue={from} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 font-mono text-[0.62rem] uppercase tracking-wider text-muted">
          По
          <input type="date" name="to" defaultValue={to} className={inputCls} />
        </label>
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
