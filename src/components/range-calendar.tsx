"use client";

import { useEffect, useRef, useState } from "react";

const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];
const MONTHS_SHORT = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m: m - 1, d };
};
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
// Monday-first weekday index (0 = Пн … 6 = Вс) for the 1st of the month.
const firstDow = (y: number, m: number) => (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
const dayLabel = (s: string) => {
  const { m, d } = parse(s);
  return `${d} ${MONTHS_SHORT[m]}`;
};

/**
 * Aggregator-style range picker for the departure-date window. Click a start day,
 * then an end day — the span highlights. Renders hidden `from`/`to` (first/last day)
 * so the plain GET search form is unchanged. Single day = «from == to».
 */
export function RangeCalendar({
  defaultFrom = "",
  defaultTo = "",
  inputClassName = "",
  label = "Даты вылета",
}: {
  defaultFrom?: string;
  defaultTo?: string;
  inputClassName?: string;
  label?: string; // «Даты вылета» (one-way window) or «Туда — обратно» (round-trip)
}) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const anchor = parse(defaultFrom || todayISO);

  const [viewY, setViewY] = useState(anchor.y);
  const [viewM, setViewM] = useState(anchor.m);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo || defaultFrom);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const hasRange = Boolean(from && to && from !== to);

  function pick(day: string) {
    if (!from || hasRange) {
      // Fresh start (nothing picked yet, or a full range already chosen).
      setFrom(day);
      setTo(day);
    } else if (day < from) {
      // Clicked before the start → move the start.
      setFrom(day);
      setTo(day);
    } else {
      // Complete the range and close.
      setTo(day);
      setOpen(false);
    }
  }

  function shiftMonth(delta: number) {
    let m = viewM + delta;
    let y = viewY;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewM(m);
    setViewY(y);
  }

  const triggerText = hasRange
    ? `${dayLabel(from)} – ${dayLabel(to)}`
    : from
      ? dayLabel(from)
      : "Когда";
  const canGoPrev = iso(viewY, viewM, daysInMonth(viewY, viewM)) >= todayISO;

  const dim = daysInMonth(viewY, viewM);
  const lead = firstDow(viewY, viewM);
  const prevM = viewM === 0 ? 11 : viewM - 1;
  const prevY = viewM === 0 ? viewY - 1 : viewY;
  const prevDim = daysInMonth(prevY, prevM);
  // Leading blanks keyed by the previous month's tail dates (stable, non-index keys).
  const cells: Array<{ key: string; day: string | null }> = [
    ...Array.from({ length: lead }, (_, j) => ({
      key: iso(prevY, prevM, prevDim - lead + 1 + j),
      day: null,
    })),
    ...Array.from({ length: dim }, (_, i) => {
      const day = iso(viewY, viewM, i + 1);
      return { key: day, day };
    }),
  ];

  return (
    <div ref={boxRef} className="relative flex flex-col gap-1">
      <span className="font-mono text-[0.62rem] uppercase tracking-wider text-muted">{label}</span>
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to || from} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${inputClassName} text-left ${from ? "text-ink" : "text-muted"}`}
      >
        {triggerText}
      </button>

      {open && (
        <div className="absolute top-full left-0 z-30 mt-1 w-[17rem] rounded-card border border-line bg-card p-3 shadow-lg">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => canGoPrev && shiftMonth(-1)}
              disabled={!canGoPrev}
              className="rounded-md px-2 py-1 font-mono text-sm text-ink transition hover:bg-accent-soft disabled:opacity-30"
              aria-label="Предыдущий месяц"
            >
              ‹
            </button>
            <span className="font-display text-sm font-bold">
              {MONTHS[viewM]} {viewY}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="rounded-md px-2 py-1 font-mono text-sm text-ink transition hover:bg-accent-soft"
              aria-label="Следующий месяц"
            >
              ›
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((w) => (
              <span
                key={w}
                className="py-1 text-center font-mono text-[0.6rem] uppercase text-muted"
              >
                {w}
              </span>
            ))}
            {cells.map(({ key, day }) => {
              if (!day) return <span key={key} />;
              const isPast = day < todayISO;
              const isEnd = day === from || day === to;
              const inRange = Boolean(from && to && day > from && day < to);
              return (
                <button
                  key={day}
                  type="button"
                  disabled={isPast}
                  onClick={() => pick(day)}
                  className={`h-8 rounded-md text-center font-mono text-xs tabular-nums transition ${
                    isPast
                      ? "text-muted/40"
                      : isEnd
                        ? "bg-accent font-bold text-card"
                        : inRange
                          ? "bg-accent-soft text-ink"
                          : "text-ink hover:bg-accent-soft"
                  }`}
                >
                  {parse(day).d}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
