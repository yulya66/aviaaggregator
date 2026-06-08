import { DealFeed, type FeedCard } from "@/components/deal-feed";
import { cityName } from "@/data/airports";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();

  const [dealsRes, anomaliesRes] = await Promise.all([
    supabase
      .from("deals")
      .select(
        "id, origin_iata, destination_iata, depart_date, price_rub, airline, transfers, deep_link, last_seen_at",
      )
      .eq("is_active", true)
      .order("last_seen_at", { ascending: false })
      .limit(100),
    supabase
      .from("anomalies")
      .select(
        "id, origin_iata, destination_iata, depart_date, price_rub, airline, transfers, deep_link, discount_pct, detected_at",
      )
      .eq("is_active", true)
      .order("detected_at", { ascending: false })
      .limit(50),
  ]);

  if (dealsRes.error || anomaliesRes.error) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-bold">Лента</h1>
        <p className="mt-4 text-gray-600">Не удалось загрузить, обновите через минуту.</p>
      </main>
    );
  }

  const raw = [
    ...(dealsRes.data ?? []).map((d) => ({
      sortAt: d.last_seen_at as string,
      card: {
        key: `deal-${d.id}`,
        route: `${cityName(d.origin_iata)} → ${cityName(d.destination_iata)}`,
        routeTitle: `${d.origin_iata} → ${d.destination_iata}`,
        dateLabel: formatDate(d.depart_date),
        priceRub: d.price_rub as number,
        airline: d.airline as string | null,
        transfers: d.transfers as number,
        deepLink: d.deep_link as string,
      } satisfies FeedCard,
    })),
    ...(anomaliesRes.data ?? []).map((a) => ({
      sortAt: a.detected_at as string,
      card: {
        key: `anomaly-${a.id}`,
        route: `${cityName(a.origin_iata)} → ${cityName(a.destination_iata)}`,
        routeTitle: `${a.origin_iata} → ${a.destination_iata}`,
        dateLabel: formatDate(a.depart_date),
        priceRub: a.price_rub as number,
        airline: a.airline as string | null,
        transfers: a.transfers as number,
        deepLink: a.deep_link as string,
        badge: `−${Math.round(Number(a.discount_pct))}%`,
      } satisfies FeedCard,
    })),
  ];

  raw.sort((x, y) => (x.sortAt < y.sortAt ? 1 : -1));
  const items: FeedCard[] = raw.map((r) => r.card);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold">Лента дешёвых рейсов</h1>
      <p className="mt-2 text-gray-600">
        Все хабы (родные + транзитные). Подвиньте ползунок, чтобы отфильтровать по цене.
      </p>

      {items.length === 0 ? (
        <p className="mt-8 text-gray-600">
          Пока пусто. После первых прогонов cron здесь появятся предложения.
        </p>
      ) : (
        <DealFeed items={items} />
      )}
    </main>
  );
}
