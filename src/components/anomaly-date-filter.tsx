import Link from "next/link";
import { presetWindow } from "@/lib/anomaly-window";
import { chipClass } from "./chip";
import { DateRange } from "./date-range";

const inputCls =
  "rounded-lg border border-line bg-paper px-3 py-2 font-mono text-sm text-ink outline-none focus:border-accent";

const PRESETS = [
  { months: 1, label: "Месяц" },
  { months: 3, label: "3 месяца" },
  { months: 6, label: "Полгода" },
];

/**
 * The «с / по» period for /anomalies. State lives in the URL: the form submits via
 * GET and the presets are plain links, so DateRange needs no rework for external
 * control. `key` recreates the inputs when a preset is followed — without it React
 * would keep their previous internal state.
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
              className={chipClass(active)}
              aria-current={active ? "true" : undefined}
            >
              {preset.label}
            </Link>
          );
        })}
        <Link
          href="/anomalies"
          className={chipClass(!from && !to)}
          aria-current={!from && !to ? "true" : undefined}
        >
          Все даты
        </Link>
      </div>
    </div>
  );
}
