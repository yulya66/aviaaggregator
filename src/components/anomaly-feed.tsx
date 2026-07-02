"use client";

import { useState } from "react";
import { rankByToggles } from "@/lib/rank";
import type { TripLeg } from "@/lib/trip/store";
import { DealCard } from "./deal-card";
import { SortToggles } from "./sort-toggles";

export type AnomalyItem = {
  key: string;
  ring: boolean; // ≥50% discount — highlight with the accent ring
  route: string;
  routeTitle: string;
  dateLabel: string;
  departDate: string;
  priceRub: number;
  airline: string | null;
  transfers: number;
  deepLink: string;
  badge: string;
  trip: TripLeg;
};

/** Anomalies list with the same price/date/both sort toggles as the deals feed. */
export function AnomalyFeed({ items }: { items: AnomalyItem[] }) {
  const [byPrice, setByPrice] = useState(true);
  const [byDate, setByDate] = useState(false);
  const shown = rankByToggles(items, byPrice, byDate);

  return (
    <div>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <SortToggles
          byPrice={byPrice}
          byDate={byDate}
          setByPrice={setByPrice}
          setByDate={setByDate}
        />
      </div>

      <div className="mt-5 space-y-3">
        {shown.map((a) => (
          <div
            key={a.key}
            className={
              a.ring ? "rounded-card ring-2 ring-accent ring-offset-2 ring-offset-paper" : ""
            }
          >
            <DealCard
              route={a.route}
              routeTitle={a.routeTitle}
              dateLabel={a.dateLabel}
              priceRub={a.priceRub}
              airline={a.airline}
              transfers={a.transfers}
              deepLink={a.deepLink}
              badge={a.badge}
              trip={a.trip}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
