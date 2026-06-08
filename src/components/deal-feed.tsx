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

  return (
    <div>
      <div className="mt-6 rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Цена до {RUB.format(limit)}</span>
          <span className="text-gray-500">
            показано {shown.length} из {items.length}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={maxPrice}
          step={500}
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="mt-2 w-full"
          aria-label="Максимальная цена"
        />
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 text-gray-600">
          Нет билетов дешевле {RUB.format(limit)}. Подвиньте ползунок выше.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
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
