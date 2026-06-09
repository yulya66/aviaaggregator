"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type TripLeg = {
  id: string; // `${origin}_${destination}_${departDate}` — dedupe key
  origin: string;
  destination: string;
  route: string; // "Самара → Стамбул" (pre-translated, no city map in the client)
  dateLabel: string; // "12.09.2026"
  departDate: string; // "2026-09-12" (for chaining the next leg)
  priceRub: number;
  airline: string | null;
  transfers: number;
  deepLink: string;
};

const KEY = "aviatop.trip.v1";

type TripCtx = {
  legs: TripLeg[];
  hydrated: boolean;
  add: (leg: TripLeg) => void;
  remove: (id: string) => void;
  has: (id: string) => boolean;
  clear: () => void;
  total: number;
};

const Ctx = createContext<TripCtx | null>(null);

/** Browser-local trip builder (no login). One ordered list of legs in localStorage. */
export function TripProvider({ children }: { children: React.ReactNode }) {
  const [legs, setLegs] = useState<TripLeg[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLegs(JSON.parse(raw) as TripLeg[]);
    } catch {
      // corrupt/unavailable storage — start empty
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(legs));
    } catch {
      // ignore quota/availability errors
    }
  }, [legs, hydrated]);

  const add = useCallback((leg: TripLeg) => {
    setLegs((prev) => (prev.some((l) => l.id === leg.id) ? prev : [...prev, leg]));
  }, []);
  const remove = useCallback((id: string) => {
    setLegs((prev) => prev.filter((l) => l.id !== id));
  }, []);
  const has = useCallback((id: string) => legs.some((l) => l.id === id), [legs]);
  const clear = useCallback(() => setLegs([]), []);
  const total = useMemo(() => legs.reduce((s, l) => s + l.priceRub, 0), [legs]);

  const value = useMemo(
    () => ({ legs, hydrated, add, remove, has, clear, total }),
    [legs, hydrated, add, remove, has, clear, total],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTrip(): TripCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTrip must be used within TripProvider");
  return ctx;
}
