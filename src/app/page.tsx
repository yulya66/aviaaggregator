import { DealFeed, type FeedCard } from "@/components/deal-feed";
import { cityName } from "@/data/airports";
import { ALL_HUB_CODES } from "@/data/hubs";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const DEAL_COLS =
  "id, origin_iata, destination_iata, depart_date, price_rub, airline, transfers, deep_link";

type DealRowDb = {
  id: string;
  origin_iata: string;
  destination_iata: string;
  depart_date: string;
  price_rub: number;
  airline: string | null;
  transfers: number;
  deep_link: string;
  discount_pct?: number;
};

export default async function HomePage() {
  const supabase = await createClient();

  // One query per home hub (cheapest fares touching that city, either direction) so every
  // city is represented evenly — the globally-cheapest set was dominated by one or two hubs.
  const [hubResults, anomaliesRes] = await Promise.all([
    Promise.all(
      ALL_HUB_CODES.map((hub) =>
        supabase
          .from("deals")
          .select(DEAL_COLS)
          .eq("is_active", true)
          .or(`origin_iata.eq.${hub},destination_iata.eq.${hub}`)
          .order("price_rub", { ascending: true })
          .limit(70),
      ),
    ),
    supabase
      .from("anomalies")
      .select(`${DEAL_COLS}, discount_pct`)
      .eq("is_active", true)
      .order("price_rub", { ascending: true })
      .limit(60),
  ]);

  if (hubResults.some((r) => r.error) || anomaliesRes.error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-3xl font-extrabold">Лента</h1>
        <p className="mt-4 text-muted">Не удалось загрузить, обновите через минуту.</p>
      </main>
    );
  }

  // Merge + dedupe deals by id (a home↔home route comes back under both hubs).
  const dealsById = new Map<string, DealRowDb>();
  for (const res of hubResults) {
    for (const d of (res.data ?? []) as DealRowDb[]) dealsById.set(d.id, d);
  }

  const toCard = (d: DealRowDb, prefix: string): FeedCard => ({
    key: `${prefix}-${d.id}`,
    origin: d.origin_iata,
    destination: d.destination_iata,
    departDate: d.depart_date,
    route: `${cityName(d.origin_iata)} → ${cityName(d.destination_iata)}`,
    routeTitle: `${d.origin_iata} → ${d.destination_iata}`,
    dateLabel: formatDate(d.depart_date),
    priceRub: d.price_rub,
    airline: d.airline,
    transfers: d.transfers,
    deepLink: d.deep_link,
    ...(d.discount_pct != null ? { badge: `−${Math.round(Number(d.discount_pct))}%` } : {}),
  });

  const items: FeedCard[] = [
    ...[...dealsById.values()].map((d) => toCard(d, "deal")),
    ...((anomaliesRes.data ?? []) as DealRowDb[]).map((a) => toCard(a, "anomaly")),
  ].sort((x, y) => x.priceRub - y.priceRub);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="kicker">Рейсы из ваших городов</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold leading-[1.04] tracking-tight sm:text-5xl">
        Дешёвые рейсы
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted">
        Самые низкие цены — туда и обратно, по всем домашним хабам. Двигайте ползунок, чтобы найти
        самое горячее предложение.
      </p>

      {items.length === 0 ? (
        <p className="mt-10 text-muted">
          Пока пусто. После первых прогонов cron здесь появятся предложения.
        </p>
      ) : (
        <DealFeed items={items} />
      )}
    </main>
  );
}
