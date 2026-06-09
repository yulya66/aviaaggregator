"use client";

import Link from "next/link";
import { useTrip } from "@/lib/trip/store";

/** Header link to the trip with a live leg count. */
export function TripBadge() {
  const { legs, hydrated } = useTrip();
  const n = hydrated ? legs.length : 0;
  return (
    <Link href="/trip" className="transition hover:text-accent">
      Поездка{n > 0 ? ` · ${n}` : ""}
    </Link>
  );
}
