import Link from "next/link";
import { presetWindow } from "@/lib/anomaly-window";
import { DateRange } from "./date-range";

const inputCls =
  "rounded-lg border border-line bg-paper px-3 py-2 font-mono text-sm text-ink outline-none focus:border-accent";

const chip = (active: boolean) =>
  `rounded-full px-3 py-1.5 font-mono text-[0.66rem] uppercase tracking-wider transition ${
    active ? "bg-ink text-card" : "border border-line text-muted hover:border-ink hover:text-ink"
  }`;

const PRESETS = [
  { months: 1, label: "Месяц" },
  { months: 3, label: "3 месяца" },
  { months: 6, label: "Полгода" },
];

/**
 * Период «с / по» для /anomalies. Состояние живёт в адресе: форма уходит методом GET,
 * пресеты — обычные ссылки, поэтому DateRange не нужно переделывать под внешнее
 * управление. `key` пересоздаёт поля при переходе по пресету, иначе React сохранит
 * прежнее внутреннее состояние инпутов.
 */
export function AnomalyDateFilter({
  from,
  to,
  today,
}: {
  from: string;
  to: string;
  today: string;
}) {
  return (
    <div className="mt-6 rounded-card border border-line bg-card p-4">
      <form method="get" className="flex flex-wrap items-end gap-3">
        <DateRange
          key={`${from}-${to}`}
          defaultFrom={from}
          defaultTo={to}
          inputClassName={inputCls}
        />
        <button
          type="submit"
          className="rounded-lg bg-ink px-4 py-2 font-mono text-xs uppercase tracking-[0.18em] text-card transition hover:bg-accent"
        >
          Показать
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((preset) => {
          const range = presetWindow(preset.months, today);
          const active = from === range.from && to === range.to;
          return (
            <Link
              key={preset.months}
              href={`/anomalies?from=${range.from}&to=${range.to}`}
              className={chip(active)}
            >
              {preset.label}
            </Link>
          );
        })}
        <Link href="/anomalies" className={chip(!from && !to)}>
          Все даты
        </Link>
      </div>
    </div>
  );
}
