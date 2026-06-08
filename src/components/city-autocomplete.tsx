"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type City = { code: string; name: string };

export function CityAutocomplete({
  name,
  defaultCode = "",
  defaultLabel = "",
  placeholder = "Город или страна",
  className = "",
  popular = [],
}: {
  name: string;
  defaultCode?: string;
  defaultLabel?: string;
  placeholder?: string;
  className?: string;
  popular?: ReadonlyArray<{ code: string; label: string }>;
}) {
  const popularCities: City[] = useMemo(
    () => popular.map((p) => ({ code: p.code, name: p.label })),
    [popular],
  );

  const [query, setQuery] = useState(defaultLabel);
  const [code, setCode] = useState(defaultCode);
  const [items, setItems] = useState<City[]>(popularCities);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Debounced search; <2 chars falls back to the popular list.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setItems(popularCities);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cities?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = (await res.json()) as { items: City[] };
        setItems(data.items);
        setActive(0);
      } catch {
        // aborted or offline — keep last suggestions
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, popularCities]);

  function pick(c: City) {
    setQuery(c.name);
    setCode(c.code);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (open && items[active]) {
        e.preventDefault();
        pick(items[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative">
      {/* IATA code actually submitted with the form */}
      <input type="hidden" name={name} value={code} />
      <input
        type="text"
        autoComplete="off"
        value={query}
        placeholder={placeholder}
        className={className}
        onChange={(e) => {
          setQuery(e.target.value);
          setCode(""); // typing invalidates the previous pick
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && items.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-line bg-card py-1 shadow-lg">
          {items.map((c, i) => (
            <li key={c.code}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(c);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                  i === active ? "bg-accent-soft text-ink" : "text-ink"
                }`}
              >
                <span>{c.name}</span>
                <span className="font-mono text-[0.65rem] text-muted">{c.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
