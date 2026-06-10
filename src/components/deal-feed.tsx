"use client";

import { useState } from "react";
import { HOME_HUBS, TRANSIT_HUBS } from "@/data/hubs";
import { DealCard } from "./deal-card";

export type FeedCard = {
  key: string;
  origin: string; // IATA, for hub filtering
  destination: string; // IATA
  route: string;
  routeTitle: string;
  dateLabel: string;
  departDate: string; // YYYY-MM-DD (raw, for the trip builder)
  priceRub: number;
  airline: string | null;
  transfers: number;
  deepLink: string;
  badge?: string;
  priceNote?: string; // "цена от 07.06"
};

const RUB = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const MAX_PRICE = 50000;
const RENDER_CAP = 200;

/** Client feed: price slider (+ optional home/transit hub chips for the discovery feed). */
export function DealFeed({
  items,
  showHubFilters = true,
  priceCap = MAX_PRICE,
}: {
  items: FeedCard[];
  showHubFilters?: boolean;
  priceCap?: number;
}) {
  const [limit, setLimit] = useState(priceCap);
  const [hubs, setHubs] = useState<string[]>([]);
  // Independent toggles; both on = combined "cheap AND soon" ranking.
  const [byPrice, setByPrice] = useState(true);
  const [byDate, setByDate] = useState(false);

  const toggleHub = (code: string) =>
    setHubs((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  const filtered = items.filter(
    (i) =>
      i.priceRub <= limit &&
      (hubs.length === 0 || hubs.includes(i.origin) || hubs.includes(i.destination)),
  );

  let shown: FeedCard[];
  if (byPrice && byDate) {
    // Normalize both axes to 0..1 and rank by the sum — cheapest-soonest first.
    const maxPrice = Math.max(...filtered.map((i) => i.priceRub), 1);
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const days = (i: FeedCard) => Math.max(0, (Date.parse(i.departDate) - now) / dayMs);
    const maxDays = Math.max(...filtered.map(days), 1);
    const score = (i: FeedCard) => i.priceRub / maxPrice + days(i) / maxDays;
    shown = [...filtered].sort((a, b) => score(a) - score(b));
  } else if (byDate) {
    shown = [...filtered].sort(
      (a, b) => a.departDate.localeCompare(b.departDate) || a.priceRub - b.priceRub,
    );
  } else {
    shown = [...filtered].sort((a, b) => a.priceRub - b.priceRub);
  }
  const visible = shown.slice(0, RENDER_CAP);
  const fill = (limit / priceCap) * 100;

  const chip = (h: { code: string; label: string }) => {
    const active = hubs.includes(h.code);
    return (
      <button
        key={h.code}
        type="button"
        onClick={() => toggleHub(h.code)}
        className={`whitespace-nowrap rounded-full border px-3 py-1 font-mono text-[0.68rem] uppercase tracking-wider transition ${
          active
            ? "border-accent bg-accent text-card"
            : "border-line text-muted hover:border-ink hover:text-ink"
        }`}
      >
        {h.label}
      </button>
    );
  };

  return (
    <div>
      <div className="mt-6 rounded-card border border-line bg-card p-5">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <p className="kicker">Цена до</p>
            <p
              className={`font-mono text-sm font-bold tabular-nums ${
                limit >= priceCap ? "text-muted" : "text-accent"
              }`}
            >
              {RUB.format(limit)}
            </p>
          </div>
          <p className="font-mono text-[0.7rem] uppercase tracking-widest text-muted">
            {shown.length} рейсов
          </p>
        </div>
        <input
          type="range"
          min={0}
          max={priceCap}
          step={500}
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="fare-range mt-4"
          style={{ ["--fill" as string]: `${fill}%` }}
          aria-label="Максимальная цена"
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(
            [
              {
                label: "Сначала топ",
                active: byPrice,
                // keep at least one mode on: refuse to turn off if it's the last active
                toggle: () => setByPrice((v) => (v && !byDate ? v : !v)),
              },
              {
                label: "Ближайшие по дате",
                active: byDate,
                toggle: () => setByDate((v) => (v && !byPrice ? v : !v)),
              },
            ] as const
          ).map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={s.toggle}
              className={`rounded-full px-3 py-1.5 font-mono text-[0.66rem] uppercase tracking-wider transition ${
                s.active
                  ? "bg-ink text-card"
                  : "border border-line text-muted hover:border-ink hover:text-ink"
              }`}
            >
              {s.label}
            </button>
          ))}
          {byPrice && byDate && (
            <span className="font-mono text-[0.62rem] uppercase tracking-wider text-accent">
              = топ и скоро
            </span>
          )}
        </div>

        {showHubFilters && (
          <>
            <p className="kicker mt-5">Ваши города — вылет или прилёт</p>
            <div className="mt-2 flex flex-wrap gap-2">{HOME_HUBS.map(chip)}</div>

            <p className="kicker mt-3">Транзитные хабы</p>
            <div className="mt-2 flex flex-wrap gap-2">{TRANSIT_HUBS.map(chip)}</div>
          </>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="mt-8 text-center text-muted">
          {showHubFilters
            ? "Ничего под эти фильтры. Поднимите цену или снимите города."
            : "Ничего под эту цену. Поднимите ползунок."}
        </p>
      ) : (
        <>
          <div className="mt-5 space-y-3">
            {visible.map((item) => (
              <DealCard
                key={item.key}
                route={item.route}
                routeTitle={item.routeTitle}
                dateLabel={item.dateLabel}
                priceRub={item.priceRub}
                airline={item.airline}
                transfers={item.transfers}
                deepLink={item.deepLink}
                badge={item.badge}
                priceNote={item.priceNote}
                trip={{
                  id: `${item.origin}_${item.destination}_${item.departDate}`,
                  origin: item.origin,
                  destination: item.destination,
                  route: item.route,
                  dateLabel: item.dateLabel,
                  departDate: item.departDate,
                  priceRub: item.priceRub,
                  airline: item.airline,
                  transfers: item.transfers,
                  deepLink: item.deepLink,
                }}
              />
            ))}
          </div>
          {shown.length > RENDER_CAP && (
            <p className="mt-6 text-center font-mono text-[0.72rem] uppercase tracking-wider text-muted">
              Показаны первые {RENDER_CAP} — уточните фильтры, чтобы увидеть остальное
            </p>
          )}
        </>
      )}
    </div>
  );
}
