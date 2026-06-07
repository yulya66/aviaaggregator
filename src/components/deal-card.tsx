import { cityName } from "@/data/airports";

type DealCardProps = {
  origin: string;
  destination: string;
  departDate: string;
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
  origin,
  destination,
  departDate,
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
          <span className="font-semibold" title={`${origin} → ${destination}`}>
            {cityName(origin)} → {cityName(destination)}
          </span>
          {badge && (
            <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              {badge}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-600">
          {departDate} · {transfers === 0 ? "прямой" : `пересадок: ${transfers}`}
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
