import Link from "next/link";
import { AnomalyDateFilter } from "@/components/anomaly-date-filter";
import { AnomalyFeed, type AnomalyItem } from "@/components/anomaly-feed";
import { cityName, routeCountries } from "@/data/airports";
import { anomalyWindow } from "@/lib/anomaly-window";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AnomalySearch = { from?: string; to?: string };

export default async function AnomaliesPage({
  searchParams,
}: {
  searchParams: Promise<AnomalySearch>;
}) {
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const range = anomalyWindow({ from: sp.from, to: sp.to, today });
  const supabase = await createClient();

  let query = supabase
    .from("anomalies")
    .select(
      "id, origin_iata, destination_iata, depart_date, price_rub, median_price_rub, airline, transfers, deep_link, discount_pct",
    )
    .eq("is_active", true)
    .gte("depart_date", range.gte);

  if (range.lte) query = query.lte("depart_date", range.lte);

  const { data, error } = await query.order("discount_pct", { ascending: false }).limit(100);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-3xl font-extrabold">Аномалии</h1>
        <p className="mt-4 text-muted">Не удалось загрузить, обновите через минуту.</p>
      </main>
    );
  }

  const rows = data ?? [];
  const items: AnomalyItem[] = rows.map((a) => {
    const discount = Math.round(Number(a.discount_pct));
    const route = `${cityName(a.origin_iata)} → ${cityName(a.destination_iata)}`;
    return {
      key: a.id,
      ring: discount >= 50,
      route,
      routeTitle: `${a.origin_iata} → ${a.destination_iata}`,
      dateLabel: formatDate(a.depart_date),
      departDate: a.depart_date,
      priceRub: a.price_rub,
      airline: a.airline,
      transfers: a.transfers,
      deepLink: a.deep_link,
      badge: `−${discount}% (обычно ${a.median_price_rub} ₽)`,
      regionNote: routeCountries(a.origin_iata, a.destination_iata),
      trip: {
        id: `${a.origin_iata}_${a.destination_iata}_${a.depart_date}`,
        origin: a.origin_iata,
        destination: a.destination_iata,
        route,
        dateLabel: formatDate(a.depart_date),
        departDate: a.depart_date,
        priceRub: a.price_rub,
        airline: a.airline,
        transfers: a.transfers,
        deepLink: a.deep_link,
      },
    };
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="kicker">L3 · детектор выбросов</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
        Аномалии
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted">
        Цены, рухнувшие заметно ниже своей медианы. Красная рамка — скидка ≥ 50%.
      </p>

      <AnomalyDateFilter from={range.from} to={range.to} today={today} />

      {items.length === 0 ? (
        range.active ? (
          <p className="mt-10 text-muted">
            На выбранные даты аномалий нет.{" "}
            <Link href="/anomalies" className="underline">
              Показать все
            </Link>
          </p>
        ) : (
          <p className="mt-10 text-muted">Аномалий пока нет — движок копит снапшоты ~14 дней.</p>
        )
      ) : (
        <AnomalyFeed items={items} />
      )}
    </main>
  );
}
