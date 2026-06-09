"use client";

import { type TripLeg, useTrip } from "@/lib/trip/store";

/** Toggle a flight in/out of the browser-local trip. */
export function AddToTrip({ leg }: { leg: TripLeg }) {
  const { has, add, remove, hydrated } = useTrip();
  const inTrip = hydrated && has(leg.id);
  return (
    <button
      type="button"
      onClick={() => (inTrip ? remove(leg.id) : add(leg))}
      className={`font-mono text-[0.62rem] uppercase tracking-[0.14em] transition ${
        inTrip ? "text-muted hover:text-accent" : "text-accent hover:opacity-70"
      }`}
    >
      {inTrip ? "✓ в поездке" : "+ в поездку"}
    </button>
  );
}
