"use client";

import { useState } from "react";
import { DealCard } from "./deal-card";

export type FeedCard = {
  key: string;
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

/** Client feed with a max-price slider that filters the (server-loaded) cards live. */
export function DealFeed({ items }: { items: FeedCard[] }) {
  const maxPrice = items.reduce((m, i) => Math.max(m, i.priceRub), 0);
  const [limit, setLimit] = useState(maxPrice);

  const shown = items.filter((i) => i.priceRub <= limit);
  const fill = maxPrice > 0 ? (limit / maxPrice) * 100 : 100;

  return (
    <div>
      <div className="sticky top-[60px] z-10 mt-6 rounded-card border border-line bg-card/90 p-5 backdrop-blur-md">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="kicker">Цена до</p>
            <p className="font-mono text-2xl font-bold tabular-nums">{RUB.format(limit)}</p>
          </div>
          <p className="font-mono text-[0.7rem] uppercase tracking-widest text-muted">
            {shown.length} / {items.length} рейсов
          </p>
        </div>
        <input
          type="range"
          min={0}
          max={maxPrice}
          step={500}
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="fare-range mt-4"
          style={{ ["--fill" as string]: `${fill}%` }}
          aria-label="Максимальная цена"
        />
      </div>

      {shown.length === 0 ? (
        <p className="mt-8 text-center text-muted">
          Нет билетов дешевле {RUB.format(limit)}. Подвиньте ползунок выше.
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
