"use client";

import type { Dispatch, SetStateAction } from "react";

/**
 * The «Сначала топ» / «Ближайшие по дате» sort toggles shared by the deals feed
 * and the anomalies list. Independent switches; both on = combined «топ и скоро»
 * ranking. At least one stays on (refuses to turn off the last active one).
 * Renders a fragment so callers can place it in their own flex row.
 */
export function SortToggles({
  byPrice,
  byDate,
  setByPrice,
  setByDate,
}: {
  byPrice: boolean;
  byDate: boolean;
  setByPrice: Dispatch<SetStateAction<boolean>>;
  setByDate: Dispatch<SetStateAction<boolean>>;
}) {
  const toggles = [
    {
      label: "Сначала топ",
      active: byPrice,
      toggle: () => setByPrice((v) => (v && !byDate ? v : !v)),
    },
    {
      label: "Ближайшие по дате",
      active: byDate,
      toggle: () => setByDate((v) => (v && !byPrice ? v : !v)),
    },
  ] as const;

  return (
    <>
      {toggles.map((s) => (
        <button
          key={s.label}
          type="button"
          onClick={s.toggle}
          className={`rounded-full px-3 py-1.5 font-mono text-[0.66rem] uppercase tracking-wider transition ${
            s.active
              ? "bg-ink text-card"
              : "border border-line text-muted hover:border-ink hover:text-ink"
          }`}
        >
          {s.label}
        </button>
      ))}
      {byPrice && byDate && (
        <span className="font-mono text-[0.62rem] uppercase tracking-wider text-accent">
          = топ и скоро
        </span>
      )}
    </>
  );
}
