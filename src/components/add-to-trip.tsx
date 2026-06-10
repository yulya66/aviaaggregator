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
      className={`w-full rounded-lg border py-2 text-center font-mono text-[0.66rem] uppercase tracking-[0.12em] transition ${
        inTrip
          ? "border-line bg-paper text-muted hover:border-accent hover:text-accent"
          : "border-accent text-accent hover:bg-accent hover:text-card"
      }`}
    >
      {inTrip ? "✓ в поездке" : "+ в поездку"}
    </button>
  );
}
