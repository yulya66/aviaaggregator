type DealCardProps = {
  route: string; // "Екатеринбург → Сочи" (pre-translated server-side)
  routeTitle?: string; // "SVX → AER" (IATA, shown on hover)
  dateLabel: string; // "12.09.2026"
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

export function DealCard({
  route,
  routeTitle,
  dateLabel,
  priceRub,
  airline,
  transfers,
  deepLink,
  badge,
}: DealCardProps) {
  return (
    <article className="group flex items-stretch overflow-hidden rounded-card border border-line bg-card shadow-[0_1px_0_rgba(24,20,16,0.03)] transition duration-200 hover:-translate-y-0.5 hover:border-ink/20 hover:shadow-[0_14px_30px_-18px_rgba(24,20,16,0.45)]">
      {/* Route + meta */}
      <div className="min-w-0 flex-1 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3
            className="truncate font-display text-base font-bold tracking-tight"
            title={routeTitle}
          >
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
        </p>
      </div>

      {/* Perforation */}
      <div className="ticket-divider my-2" />

      {/* Price stub */}
      <div className="flex w-[8.5rem] shrink-0 flex-col items-end justify-between p-5 sm:w-40">
        <span className="font-mono text-xl font-bold tracking-tight tabular-nums">
          {RUB.format(priceRub)}
        </span>
        <a
          href={deepLink}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-accent transition group-hover:translate-x-0.5"
        >
          Купить →
        </a>
      </div>
    </article>
  );
}
