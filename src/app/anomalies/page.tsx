import { DealCard } from "@/components/deal-card";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AnomaliesPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("anomalies")
    .select(
      "id, origin_iata, destination_iata, depart_date, price_rub, median_price_rub, airline, transfers, deep_link, discount_pct",
    )
    .eq("is_active", true)
    .order("discount_pct", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-bold">Аномалии</h1>
        <p className="mt-4 text-gray-600">Не удалось загрузить, обновите через минуту.</p>
      </main>
    );
  }

  const rows = data ?? [];

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold">Аномалии (L3)</h1>
      <p className="mt-2 text-gray-600">
        Выбросы цены из транзитных хабов. Подсветка — скидка ≥ 50%.
      </p>

      {rows.length === 0 ? (
        <p className="mt-8 text-gray-600">Аномалий пока нет — движок копит снапшоты ~14 дней.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map((a) => {
            const discount = Math.round(Number(a.discount_pct));
            return (
              <div key={a.id} className={discount >= 50 ? "rounded-lg ring-2 ring-red-400" : ""}>
                <DealCard
                  origin={a.origin_iata}
                  destination={a.destination_iata}
                  departDate={a.depart_date}
                  priceRub={a.price_rub}
                  airline={a.airline}
                  transfers={a.transfers}
                  deepLink={a.deep_link}
                  badge={`−${discount}% (обычно ${a.median_price_rub} ₽)`}
                />
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
