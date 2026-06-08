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
    <article className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-semibold" title={routeTitle}>
            {route}
          </span>
          {badge && (
            <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-600">
          {dateLabel} · {transfers === 0 ? "прямой" : `пересадок: ${transfers}`}
          {airline ? ` · ${airline}` : ""}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-lg font-bold">{RUB.format(priceRub)}</span>
        <a
          href={deepLink}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded bg-black px-3 py-1 text-sm text-white hover:bg-gray-800"
        >
          Купить
        </a>
      </div>
    </article>
  );
}
