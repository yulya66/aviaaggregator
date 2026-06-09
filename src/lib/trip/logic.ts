import type { TripLeg } from "./store";

/** Append a leg unless one with the same id is already in the trip. */
export function addLeg(legs: TripLeg[], leg: TripLeg): TripLeg[] {
  return legs.some((l) => l.id === leg.id) ? legs : [...legs, leg];
}

export function removeLeg(legs: TripLeg[], id: string): TripLeg[] {
  return legs.filter((l) => l.id !== id);
}

export function totalOf(legs: TripLeg[]): number {
  return legs.reduce((s, l) => s + l.priceRub, 0);
}

/** Indices of legs that depart before the previous leg (broken self-transfer chain). */
export function dateConflicts(legs: TripLeg[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < legs.length; i++) {
    if (legs[i].departDate < legs[i - 1].departDate) out.push(i);
  }
  return out;
}
