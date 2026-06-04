import { DealCard } from "@/components/deal-card";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type FeedItem = {
  key: string;
  origin: string;
  destination: string;
  departDate: string;
  priceRub: number;
  airline: string | null;
  transfers: number;
  deepLink: string;
  badge?: string;
  sortAt: string;
};

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
      .limit(50),
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

  const items: FeedItem[] = [
    ...(dealsRes.data ?? []).map((d) => ({
      key: `deal-${d.id}`,
      origin: d.origin_iata,
      destination: d.destination_iata,
      departDate: d.depart_date,
      priceRub: d.price_rub,
      airline: d.airline,
      transfers: d.transfers,
      deepLink: d.deep_link,
      sortAt: d.last_seen_at,
    })),
    ...(anomaliesRes.data ?? []).map((a) => ({
      key: `anomaly-${a.id}`,
      origin: a.origin_iata,
      destination: a.destination_iata,
      departDate: a.depart_date,
      priceRub: a.price_rub,
      airline: a.airline,
      transfers: a.transfers,
      deepLink: a.deep_link,
      badge: `−${Math.round(Number(a.discount_pct))}%`,
      sortAt: a.detected_at,
    })),
  ].sort((x, y) => (x.sortAt < y.sortAt ? 1 : -1));

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold">Лента дешёвых рейсов</h1>
      <p className="mt-2 text-gray-600">
        L2 (родные хабы) + L3 (аномалии). Обновляется по расписанию.
      </p>

      {items.length === 0 ? (
        <p className="mt-8 text-gray-600">
          Пока пусто. После первых прогонов cron здесь появятся предложения (L3 копит данные ~14
          дней до первых аномалий).
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {items.map((item) => (
            <DealCard
              key={item.key}
              origin={item.origin}
              destination={item.destination}
              departDate={item.departDate}
              priceRub={item.priceRub}
              airline={item.airline}
              transfers={item.transfers}
              deepLink={item.deepLink}
              badge={item.badge}
            />
          ))}
        </div>
      )}
    </main>
  );
}
