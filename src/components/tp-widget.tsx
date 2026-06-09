"use client";

import { useEffect, useRef } from "react";

/**
 * Aviasales search-form widget (Travelpayouts). Lives behind an env var:
 * set NEXT_PUBLIC_TP_WIDGET_SRC to the script src from the TP dashboard
 * (Инструменты → Виджеты → Поисковая форма → код вставки → значение src).
 * Unset → renders nothing. The widget runs a LIVE Aviasales search with our
 * marker — prices behind it always match Aviasales.
 */
export function TpWidget() {
  const src = process.env.NEXT_PUBLIC_TP_WIDGET_SRC;
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!src || !boxRef.current || boxRef.current.childElementCount > 0) return;
    const s = document.createElement("script");
    s.async = true;
    s.charset = "utf-8";
    s.src = src;
    boxRef.current.appendChild(s);
  }, [src]);

  if (!src) return null;

  return (
    <section className="mt-8 rounded-card border border-line bg-card p-5">
      <p className="kicker">Точная цена · живой поиск Aviasales</p>
      <p className="mt-1 text-sm text-muted">
        Цены в ленте — ориентир из кэша. Здесь — настоящий поиск: цена совпадает с Aviasales.
      </p>
      <div ref={boxRef} className="mt-4" />
    </section>
  );
}
