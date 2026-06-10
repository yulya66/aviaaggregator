"use client";

import Link from "next/link";
import { TpWidget } from "@/components/tp-widget";
import { useTrip } from "@/lib/trip/store";

const RUB = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

export default function TripPage() {
  const { legs, hydrated, remove, clear, total } = useTrip();
  const last = legs[legs.length - 1];
  const lastCity = last?.route.split("→").pop()?.trim() ?? "";

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="kicker">Мультигород · отдельные билеты</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
        Моя поездка
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted">
        Собирайте маршрут из рейсов: добавляйте «туда», обратный или стыковочный. Это{" "}
        <b>отдельные билеты</b> — при пересадке закладывайте время с запасом.
      </p>

      {!hydrated ? (
        <p className="mt-10 text-muted">Загрузка…</p>
      ) : legs.length === 0 ? (
        <div className="mt-10 rounded-card border border-line bg-card p-6">
          <p className="text-muted">
            Поездка пуста. Найдите рейс и нажмите <b>«+ в поездку»</b> на карточке.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={{ pathname: "/", query: { mode: "route" } }}
              className="rounded-lg bg-ink px-4 py-2 font-mono text-xs uppercase tracking-[0.16em] text-card transition hover:bg-accent"
            >
              Поиск по маршруту
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-line px-4 py-2 font-mono text-xs uppercase tracking-[0.16em] transition hover:border-ink"
            >
              Открыть ленту
            </Link>
          </div>
        </div>
      ) : (
        <>
          <ol className="mt-6 space-y-3">
            {legs.map((leg, i) => {
              // Soft sanity check: the next leg should not depart before the previous one.
              const prev = legs[i - 1];
              const conflict = prev && leg.departDate < prev.departDate;
              return (
                <li
                  key={leg.id}
                  className={`flex items-stretch gap-4 rounded-card border bg-card p-4 ${
                    conflict ? "border-accent" : "border-line"
                  }`}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center self-center rounded-full bg-paper font-mono text-xs text-muted">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-base font-bold tracking-tight">{leg.route}</h3>
                    <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-wider text-muted">
                      {leg.dateLabel} ·{" "}
                      {leg.transfers === 0 ? "прямой" : `пересадок ${leg.transfers}`}
                      {leg.airline ? ` · ${leg.airline}` : ""}
                    </p>
                    {conflict && (
                      <p className="mt-1 font-mono text-[0.64rem] uppercase tracking-wider text-accent">
                        ⚠ вылет раньше предыдущего рейса ({prev.dateLabel})
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end justify-between gap-2">
                    <span className="font-mono text-lg font-bold tabular-nums">
                      {RUB.format(leg.priceRub)}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => remove(leg.id)}
                        className="rounded-lg border border-line px-3 py-2 font-mono text-[0.64rem] uppercase tracking-[0.12em] text-muted transition hover:border-accent hover:text-accent"
                      >
                        удалить
                      </button>
                      <a
                        href={leg.deepLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-accent px-4 py-2 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-card transition hover:bg-ink"
                      >
                        Купить →
                      </a>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="mt-5 flex items-center justify-between rounded-card border border-ink bg-card p-5">
            <span className="font-mono text-[0.7rem] uppercase tracking-widest text-muted">
              Итого · {legs.length}{" "}
              {legs.length === 1 ? "рейс" : legs.length < 5 ? "рейса" : "рейсов"}
            </span>
            <span className="font-mono text-2xl font-bold tabular-nums">{RUB.format(total)}</span>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link
              href={{
                pathname: "/",
                query: { mode: "route", origin: last.destination, from: last.departDate },
              }}
              className="rounded-lg bg-ink px-4 py-2 font-mono text-xs uppercase tracking-[0.16em] text-card transition hover:bg-accent"
            >
              Искать дальше из {lastCity} →
            </Link>
            <Link
              href={{
                pathname: "/",
                query: {
                  mode: "route",
                  origin: last.destination,
                  dest: legs[0].origin,
                  from: last.departDate,
                },
              }}
              className="rounded-lg border border-line px-4 py-2 font-mono text-xs uppercase tracking-[0.16em] transition hover:border-ink"
            >
              Обратный рейс
            </Link>
            <button
              type="button"
              onClick={clear}
              className="ml-auto font-mono text-[0.66rem] uppercase tracking-wider text-muted transition hover:text-accent"
            >
              Очистить
            </button>
          </div>
        </>
      )}

      <TpWidget />
    </main>
  );
}
