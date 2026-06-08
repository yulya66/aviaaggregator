import { redirect } from "next/navigation";
import { cityName } from "@/data/airports";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createSavedSearch, deleteSavedSearch } from "./actions";

export const dynamic = "force-dynamic";

const RUB = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const inputCls =
  "rounded-lg border border-line bg-paper px-3 py-2 font-mono text-sm outline-none transition focus:border-accent";

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
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="kicker">L1 · персональный трекинг</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
        Мои поиски
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted">
        Отслеживаемые маршруты — cron проверяет их каждые 6 часов и кладёт совпадения в ленту.
      </p>

      <form
        action={createSavedSearch}
        className="mt-8 grid grid-cols-2 gap-3 rounded-card border border-line bg-card p-5 sm:grid-cols-3"
      >
        <input
          name="origin_iata"
          required
          placeholder="Откуда (SVX)"
          maxLength={3}
          className={`${inputCls} uppercase`}
        />
        <input
          name="destination_iata"
          required
          placeholder="Куда (AER)"
          maxLength={3}
          className={`${inputCls} uppercase`}
        />
        <input
          name="max_price_rub"
          required
          type="number"
          min={1}
          placeholder="Макс. ₽"
          className={inputCls}
        />
        <label className="flex flex-col gap-1 font-mono text-[0.65rem] uppercase tracking-wider text-muted">
          С даты
          <input name="date_from" required type="date" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 font-mono text-[0.65rem] uppercase tracking-wider text-muted">
          По дату
          <input name="date_to" required type="date" className={inputCls} />
        </label>
        <button
          type="submit"
          className="self-end rounded-lg bg-ink px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-card transition hover:bg-accent"
        >
          Добавить
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="mt-10 text-muted">Пока нет сохранённых поисков. Добавьте первый выше.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-card border border-line bg-card px-5 py-4"
            >
              <div>
                <span
                  className="font-display text-base font-bold"
                  title={`${s.origin_iata} → ${s.destination_iata ?? ""}`}
                >
                  {cityName(s.origin_iata)} →{" "}
                  {s.destination_iata ? cityName(s.destination_iata) : "куда угодно"}
                </span>
                <p className="mt-1 font-mono text-[0.72rem] uppercase tracking-wider text-muted">
                  {formatDate(s.date_from)} … {formatDate(s.date_to)} · до{" "}
                  {RUB.format(s.max_price_rub)}
                </p>
              </div>
              <form action={deleteSavedSearch}>
                <input type="hidden" name="id" value={s.id} />
                <button
                  type="submit"
                  className="font-mono text-[0.7rem] uppercase tracking-widest text-muted transition hover:text-accent"
                >
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
