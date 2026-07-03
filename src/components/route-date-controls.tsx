"use client";

import { useState } from "react";
import { RangeCalendar } from "./range-calendar";

/**
 * «В одну сторону / Туда-обратно» toggle plus the shared range calendar, for the
 * route search form. Round-trip only changes the label and submits `trip=round`;
 * the calendar's two dates become туда/обратно (spec 2026-07-03).
 */
export function RouteDateControls({
  defaultTrip = "",
  defaultFrom = "",
  defaultTo = "",
  inputClassName = "",
}: {
  defaultTrip?: string;
  defaultFrom?: string;
  defaultTo?: string;
  inputClassName?: string;
}) {
  const [round, setRound] = useState(defaultTrip === "round");
  const btn = (active: boolean) =>
    `rounded-full px-3 py-1.5 font-mono text-[0.66rem] uppercase tracking-wider transition ${
      active ? "bg-ink text-card" : "border border-line text-muted hover:border-ink hover:text-ink"
    }`;

  return (
    <>
      <div className="col-span-2 flex gap-2 sm:col-span-4">
        <input type="hidden" name="trip" value={round ? "round" : ""} />
        <button type="button" onClick={() => setRound(false)} className={btn(!round)}>
          В одну сторону
        </button>
        <button type="button" onClick={() => setRound(true)} className={btn(round)}>
          Туда-обратно
        </button>
      </div>
      <RangeCalendar
        defaultFrom={defaultFrom}
        defaultTo={defaultTo}
        inputClassName={inputClassName}
        label={round ? "Туда — обратно" : "Даты вылета"}
      />
    </>
  );
}
