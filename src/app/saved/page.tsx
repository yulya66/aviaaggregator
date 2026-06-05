import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createSavedSearch, deleteSavedSearch } from "./actions";

export const dynamic = "force-dynamic";

const RUB = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

export default async function SavedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data, error } = await supabase
    .from("saved_searches")
    .select("id, origin_iata, destination_iata, date_from, date_to, max_price_rub")
    .order("created_at", { ascending: false });

  const rows = error ? [] : (data ?? []);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold">Мои поиски</h1>
      <p className="mt-2 text-gray-600">
        Отслеживаемые маршруты. Cron проверяет их каждые 6 часов и кладёт совпадения в общую ленту.
      </p>

      <form
        action={createSavedSearch}
        className="mt-6 grid grid-cols-2 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-3"
      >
        <input
          name="origin_iata"
          required
          placeholder="Откуда (EKB)"
          maxLength={3}
          className="rounded border border-gray-300 px-3 py-2 uppercase"
        />
        <input
          name="destination_iata"
          required
          placeholder="Куда (AER)"
          maxLength={3}
          className="rounded border border-gray-300 px-3 py-2 uppercase"
        />
        <input
          name="max_price_rub"
          required
          type="number"
          min={1}
          placeholder="Макс. цена ₽"
          className="rounded border border-gray-300 px-3 py-2"
        />
        <label className="flex flex-col text-xs text-gray-600">
          С даты
          <input
            name="date_from"
            required
            type="date"
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          По дату
          <input
            name="date_to"
            required
            type="date"
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="self-end rounded bg-black px-4 py-2 text-white hover:bg-gray-800"
        >
          Добавить
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="mt-8 text-gray-600">Пока нет сохранённых поисков. Добавьте первый выше.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {rows.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded border border-gray-200 px-4 py-3"
            >
              <div>
                <span className="font-semibold">
                  {s.origin_iata} → {s.destination_iata ?? "куда угодно"}
                </span>
                <p className="mt-1 text-sm text-gray-600">
                  {s.date_from} … {s.date_to} · до {RUB.format(s.max_price_rub)}
                </p>
              </div>
              <form action={deleteSavedSearch}>
                <input type="hidden" name="id" value={s.id} />
                <button type="submit" className="text-sm text-gray-500 hover:text-red-700">
                  Удалить
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
