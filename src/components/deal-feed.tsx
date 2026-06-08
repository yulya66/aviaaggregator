"use client";

import { useState } from "react";
import { DealCard } from "./deal-card";

export type FeedCard = {
  key: string;
  origin: string; // IATA, for hub filtering
  destination: string; // IATA
  departDate: string; // YYYY-MM-DD, for date filtering
  route: string;
  routeTitle: string;
  dateLabel: string;
  priceRub: number;
  airline: string | null;
  transfers: number;
  deepLink: string;
  badge?: string;
};

const RUB = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const MAX_PRICE = 50000;

const HOME_HUBS = [
  { code: "SVX", label: "Екб" },
  { code: "MOW", label: "Мск" },
  { code: "LED", label: "Спб" },
  { code: "CEK", label: "Челябинск" },
  { code: "PEE", label: "Пермь" },
  { code: "TJM", label: "Тюмень" },
  { code: "KUF", label: "Самара" },
];

/** Client feed with a fixed price slider + home-hub filter chips. */
export function DealFeed({ items }: { items: FeedCard[] }) {
  const [limit, setLimit] = useState(MAX_PRICE);
  const [hubs, setHubs] = useState<string[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const toggleHub = (code: string) =>
    setHubs((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  const shown = items.filter(
    (i) =>
      i.priceRub <= limit &&
      (hubs.length === 0 || hubs.includes(i.origin) || hubs.includes(i.destination)) &&
      (!from || i.departDate >= from) &&
      (!to || i.departDate <= to),
  );
  const fill = (limit / MAX_PRICE) * 100;

  return (
    <div>
      <div className="sticky top-[60px] z-10 mt-6 rounded-card border border-line bg-card/90 p-5 backdrop-blur-md">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="kicker">Цена до</p>
            <p className="font-mono text-2xl font-bold tabular-nums">{RUB.format(limit)}</p>
          </div>
          <p className="font-mono text-[0.7rem] uppercase tracking-widest text-muted">
            {shown.length} рейсов
          </p>
        </div>
        <input
          type="range"
          min={0}
          max={MAX_PRICE}
          step={500}
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="fare-range mt-4"
          style={{ ["--fill" as string]: `${fill}%` }}
          aria-label="Максимальная цена"
        />

        <p className="kicker mt-5">Ваши города — вылет или прилёт</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {HOME_HUBS.map((h) => {
            const active = hubs.includes(h.code);
            return (
              <button
                key={h.code}
                type="button"
                onClick={() => toggleHub(h.code)}
                className={`rounded-full border px-3 py-1 font-mono text-[0.68rem] uppercase tracking-wider transition ${
                  active
                    ? "border-accent bg-accent text-card"
                    : "border-line text-muted hover:border-ink hover:text-ink"
                }`}
              >
                {h.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[0.68rem] uppercase tracking-wider text-muted">
          <span>Даты</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-line bg-paper px-2 py-1 text-ink outline-none focus:border-accent"
          />
          <span>—</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-line bg-paper px-2 py-1 text-ink outline-none focus:border-accent"
          />
          {(from || to) && (
            <button
              type="button"
              onClick={() => {
                setFrom("");
                setTo("");
              }}
              className="text-accent transition hover:underline"
            >
              сброс
            </button>
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="mt-8 text-center text-muted">
          Ничего под эти фильтры. Поднимите цену или снимите города.
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {shown.map((item) => (
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
