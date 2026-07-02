import type { TripLeg } from "@/lib/trip/store";
import { AddToTrip } from "./add-to-trip";

type DealCardProps = {
  route: string; // "Екатеринбург → Сочи" (pre-translated server-side)
  routeTitle?: string; // "SVX → AER" (IATA, shown on hover)
  dateLabel: string; // "12.09.2026"
  priceRub: number;
  airline: string | null;
  transfers: number;
  deepLink: string;
  badge?: string;
  trip?: TripLeg; // when set, shows the "+ в поездку" toggle
  priceNote?: string; // e.g. "цена от 07.06" — when the cached fare was last seen
  regionNote?: string; // destination country, e.g. "Турция" — shown for reference
};

const RUB = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

export function DealCard({
  route,
  routeTitle,
  dateLabel,
  priceRub,
  airline,
  transfers,
  deepLink,
  badge,
  trip,
  priceNote,
  regionNote,
}: DealCardProps) {
  return (
    <article className="group flex items-stretch overflow-hidden rounded-card border border-line bg-card shadow-[0_1px_0_rgba(24,20,16,0.03)] transition duration-200 hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-[0_14px_30px_-18px_rgba(24,20,16,0.45)]">
      {/* Route + meta */}
      <div className="min-w-0 flex-1 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-base font-bold tracking-tight" title={routeTitle}>
            {route}
          </h3>
          {badge && (
            <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 font-mono text-[0.65rem] font-semibold tracking-wide text-card">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-2 font-mono text-[0.72rem] uppercase tracking-wider text-muted">
          {dateLabel} · {transfers === 0 ? "прямой" : `пересадок ${transfers}`}
          {airline ? ` · ${airline}` : ""}
          {regionNote ? ` · ${regionNote}` : ""}
        </p>
      </div>

      {/* Perforation */}
      <div className="ticket-divider my-2" />

      {/* Price stub. "~" — cached fare, the live one is on Aviasales behind «Купить». */}
      <div className="flex w-[9.5rem] shrink-0 flex-col items-end justify-between gap-3 p-4 sm:w-44">
        <div className="text-right">
          <span className="font-mono text-xl font-bold tracking-tight tabular-nums">
            ~{RUB.format(priceRub)}
          </span>
          <p className="mt-0.5 font-mono text-[0.58rem] uppercase tracking-wider text-muted">
            {priceNote ?? "ориентир"}
          </p>
        </div>
        <div className="flex w-full flex-col gap-1.5">
          {trip && <AddToTrip leg={trip} />}
          <a
            href={deepLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-lg bg-accent py-2 text-center font-mono text-[0.7rem] uppercase tracking-[0.12em] text-card transition hover:bg-ink"
          >
            Купить →
          </a>
        </div>
      </div>
    </article>
  );
}
