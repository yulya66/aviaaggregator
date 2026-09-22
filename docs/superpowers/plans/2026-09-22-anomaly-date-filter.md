# Фильтр дат в аномалиях + страны маршрута — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить на `/anomalies` выбор периода «с / по» с пресетами и показать страны маршрута в карточках обоих списков.

**Architecture:** Фильтр хранится в адресе страницы (`?from=&to=`), фильтрация серверная и применяется к запросу Supabase до `limit(100)`. Вся арифметика границ и пресетов вынесена в чистый модуль `src/lib/anomaly-window.ts` и покрыта тестами. Страны считает новая чистая функция `routeCountries` в `src/data/airports.ts`, результат подставляется в уже существующее поле карточки `regionNote`.

**Tech Stack:** Next.js App Router (RSC), TypeScript, Tailwind, Supabase JS, Vitest, Biome.

**Спека:** `docs/superpowers/specs/2026-09-22-anomaly-date-filter-design.md`

---

## Структура файлов

| Файл | Ответственность |
|---|---|
| `src/lib/anomaly-window.ts` (создать) | Чистая логика: параметры адреса → границы запроса; расчёт пресетов |
| `src/lib/anomaly-window.test.ts` (создать) | Тесты этой логики |
| `src/components/anomaly-date-filter.tsx` (создать) | Разметка фильтра: форма GET + `DateRange` + пресеты-ссылки |
| `src/data/airports.ts` (изменить) | Добавить `routeCountries` |
| `src/data/airports.test.ts` (изменить) | Тесты `routeCountries` |
| `src/components/anomaly-feed.tsx` (изменить) | Поле `regionNote` в типе и проброс в карточку |
| `src/app/anomalies/page.tsx` (изменить) | Чтение параметров, фильтр в запросе, отрисовка фильтра, страны, пустые состояния |
| `src/app/page.tsx` (изменить) | Три вызова `routeCountries` вместо `cityCountryName` |
| `src/components/deal-card.tsx` (изменить) | Комментарий к `regionNote` |

Задачи 1 и 2 независимы. Задача 3 опирается на 1, задача 5 — на 1, 2, 3 и 4.

---

### Task 1: Модуль границ дат

**Files:**
- Create: `src/lib/anomaly-window.ts`
- Test: `src/lib/anomaly-window.test.ts`

- [ ] **Step 1: Write the failing test**

Создать `src/lib/anomaly-window.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { anomalyWindow, presetWindow } from "./anomaly-window";

const today = "2026-09-22";

describe("anomalyWindow", () => {
  it("без параметров: нижняя граница — сегодня, верх открыт, фильтр не задан", () => {
    expect(anomalyWindow({ today })).toEqual({
      gte: today,
      lte: null,
      from: "",
      to: "",
      active: false,
    });
  });

  it("берёт «С», когда он в будущем", () => {
    expect(anomalyWindow({ from: "2026-10-01", today })).toEqual({
      gte: "2026-10-01",
      lte: null,
      from: "2026-10-01",
      to: "",
      active: true,
    });
  });

  it("не пускает «С» в прошлое, но сохраняет выбор пользователя в поле", () => {
    const w = anomalyWindow({ from: "2026-01-01", today });
    expect(w.gte).toBe(today);
    expect(w.from).toBe("2026-01-01");
    expect(w.active).toBe(true);
  });

  it("ставит верхнюю границу из «По»", () => {
    expect(anomalyWindow({ to: "2026-10-31", today })).toEqual({
      gte: today,
      lte: "2026-10-31",
      from: "",
      to: "2026-10-31",
      active: true,
    });
  });

  it("не исправляет «По» раньше «С» — список просто окажется пустым", () => {
    expect(anomalyWindow({ from: "2026-10-10", to: "2026-10-01", today })).toEqual({
      gte: "2026-10-10",
      lte: "2026-10-01",
      from: "2026-10-10",
      to: "2026-10-01",
      active: true,
    });
  });

  it("игнорирует мусор вместо даты", () => {
    for (const bad of ["2026-13-40", "2026-02-31", "вчера", "", "20261001"]) {
      expect(anomalyWindow({ from: bad, to: bad, today })).toEqual({
        gte: today,
        lte: null,
        from: "",
        to: "",
        active: false,
      });
    }
  });
});

describe("presetWindow", () => {
  it("считает окна на 1, 3 и 6 месяцев от сегодня", () => {
    expect(presetWindow(1, "2026-09-22")).toEqual({ from: "2026-09-22", to: "2026-10-22" });
    expect(presetWindow(3, "2026-09-22")).toEqual({ from: "2026-09-22", to: "2026-12-22" });
    expect(presetWindow(6, "2026-09-22")).toEqual({ from: "2026-09-22", to: "2027-03-22" });
  });

  it("не перескакивает через месяц, когда сегодня 31 число", () => {
    expect(presetWindow(1, "2026-03-31")).toEqual({ from: "2026-03-31", to: "2026-04-30" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/anomaly-window.test.ts`
Expected: FAIL — `Failed to resolve import "./anomaly-window"`.

- [ ] **Step 3: Write minimal implementation**

Создать `src/lib/anomaly-window.ts`:

```ts
/** Границы запроса к таблице `anomalies` плюс очищенные значения для полей формы. */
export type DateWindow = {
  /** Нижняя граница `depart_date` — никогда не раньше сегодняшнего дня. */
  gte: string;
  /** Верхняя граница `depart_date` или null, когда «По» не заполнено. */
  lte: string | null;
  /** Значение для поля «Вылет с» ("" — параметра не было или он не прошёл проверку). */
  from: string;
  /** Значение для поля «По». */
  to: string;
  /** Задан ли фильтр — от этого зависит только текст пустого состояния. */
  active: boolean;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-10-01" → "2026-10-01"; "2026-02-31", "вчера", undefined → "". */
function cleanDate(value: string | undefined): string {
  if (!value || !ISO_DATE.test(value)) return "";
  const [y, m, d] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  const real =
    probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
  return real ? value : "";
}

/**
 * Параметры адреса → границы запроса. Прошедшие вылеты не показываются никогда:
 * нижняя граница — максимум из «С» и сегодняшнего дня. «По» раньше «С» намеренно
 * не исправляется, пользователь увидит пустой список и подсказку.
 */
export function anomalyWindow({
  from,
  to,
  today,
}: {
  from?: string;
  to?: string;
  today: string;
}): DateWindow {
  const cleanFrom = cleanDate(from);
  const cleanTo = cleanDate(to);
  return {
    gte: cleanFrom && cleanFrom > today ? cleanFrom : today,
    lte: cleanTo || null,
    from: cleanFrom,
    to: cleanTo,
    active: Boolean(cleanFrom || cleanTo),
  };
}

/**
 * Окно пресета: от сегодня на `months` месяцев вперёд. Если в целевом месяце нет
 * такого числа (31 марта + 1 месяц), берётся последний день месяца, а не переход
 * на следующий.
 */
export function presetWindow(months: number, today: string): { from: string; to: string } {
  const [y, m, d] = today.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const ty = target.getUTCFullYear();
  const tm = target.getUTCMonth();
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const to = new Date(Date.UTC(ty, tm, Math.min(d, lastDay))).toISOString().slice(0, 10);
  return { from: today, to };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/anomaly-window.test.ts`
Expected: PASS — 8 тестов зелёные.

- [ ] **Step 5: Commit**

```bash
git add src/lib/anomaly-window.ts src/lib/anomaly-window.test.ts
git commit -m "feat(anomalies): pure date-window helpers for the /anomalies filter"
```

---

### Task 2: Функция стран маршрута

**Files:**
- Modify: `src/data/airports.ts` (добавить в конец файла)
- Test: `src/data/airports.test.ts` (добавить блок describe)

- [ ] **Step 1: Write the failing test**

В `src/data/airports.test.ts` добавить `routeCountries` в список импортов и новый блок в конец файла:

```ts
describe("routeCountries", () => {
  it("показывает обе страны, когда они разные", () => {
    expect(routeCountries("SVX", "DXB")).toBe("Россия → ОАЭ");
    expect(routeCountries("SVX", "IST")).toBe("Россия → Турция");
  });

  it("не дублирует одну и ту же страну", () => {
    expect(routeCountries("SVX", "LED")).toBe("Россия");
  });

  it("опускает сторону с неизвестным кодом", () => {
    expect(routeCountries("SVX", "ZZZ")).toBe("Россия");
    expect(routeCountries("ZZZ", "IST")).toBe("Турция");
  });

  it("отдаёт пустую строку, когда обе стороны неизвестны", () => {
    expect(routeCountries("ZZZ", "QQQ")).toBe("");
  });
});
```

Строку импорта привести к виду:

```ts
import {
  cityCountryCode,
  cityCountryName,
  cityName,
  countryName,
  countryNameGenitive,
  isDomestic,
  routeCountries,
} from "./airports";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/data/airports.test.ts`
Expected: FAIL — `routeCountries is not a function` (экспорта ещё нет).

- [ ] **Step 3: Write minimal implementation**

В конец `src/data/airports.ts` добавить:

```ts
/**
 * Пара стран маршрута для подписи в карточке: «Россия → ОАЭ». Одна и та же страна
 * пишется один раз, сторона с неизвестным кодом опускается, обе неизвестные дают
 * пустую строку — тогда карточка не рисует ни разделителя, ни пробела.
 */
export function routeCountries(origin: string, destination: string): string {
  const from = cityCountryName(origin);
  const to = cityCountryName(destination);
  if (from && to) return from === to ? from : `${from} → ${to}`;
  return from || to;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/data/airports.test.ts`
Expected: PASS — прежние тесты плюс четыре новых.

- [ ] **Step 5: Commit**

```bash
git add src/data/airports.ts src/data/airports.test.ts
git commit -m "feat(airports): routeCountries — country pair label for a route"
```

---

### Task 3: Компонент фильтра

**Files:**
- Create: `src/components/anomaly-date-filter.tsx`

Тестом не покрывается: в проекте компоненты и страницы тестами не покрыты, проверка — типами, линтером и сборкой.

- [ ] **Step 1: Write the component**

Создать `src/components/anomaly-date-filter.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify it typechecks and lints**

Run: `pnpm typecheck && pnpm lint`
Expected: обе команды завершаются без ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/components/anomaly-date-filter.tsx
git commit -m "feat(anomalies): date filter component with month presets"
```

---

### Task 4: Проброс стран через ленту аномалий

**Files:**
- Modify: `src/components/anomaly-feed.tsx`

- [ ] **Step 1: Add the field to the item type**

В `src/components/anomaly-feed.tsx` в тип `AnomalyItem`, сразу после строки `badge: string;`, добавить:

```ts
  regionNote?: string; // «Россия → ОАЭ» — страны маршрута, как в ленте на главной
```

- [ ] **Step 2: Pass it to the card**

В том же файле в вызове `<DealCard … />` после строки `badge={a.badge}` добавить:

```tsx
              regionNote={a.regionNote}
```

- [ ] **Step 3: Verify it typechecks**

Run: `pnpm typecheck`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add src/components/anomaly-feed.tsx
git commit -m "feat(anomalies): pass route countries through the feed to the card"
```

---

### Task 5: Страница аномалий

**Files:**
- Modify: `src/app/anomalies/page.tsx`

- [ ] **Step 1: Replace the imports**

Заменить строки 1–4 на:

```tsx
import Link from "next/link";
import { AnomalyDateFilter } from "@/components/anomaly-date-filter";
import { AnomalyFeed, type AnomalyItem } from "@/components/anomaly-feed";
import { cityName, routeCountries } from "@/data/airports";
import { anomalyWindow } from "@/lib/anomaly-window";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
```

- [ ] **Step 2: Read the params and filter the query**

Заменить блок с сигнатурой функции и запросом (строки 8–18) на:

```tsx
type AnomalySearch = { from?: string; to?: string };

export default async function AnomaliesPage({
  searchParams,
}: {
  searchParams: Promise<AnomalySearch>;
}) {
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const range = anomalyWindow({ from: sp.from, to: sp.to, today });
  const supabase = await createClient();

  let query = supabase
    .from("anomalies")
    .select(
      "id, origin_iata, destination_iata, depart_date, price_rub, median_price_rub, airline, transfers, deep_link, discount_pct",
    )
    .eq("is_active", true)
    .gte("depart_date", range.gte);

  if (range.lte) query = query.lte("depart_date", range.lte);

  const { data, error } = await query.order("discount_pct", { ascending: false }).limit(100);
```

- [ ] **Step 3: Add the countries to the item**

В объекте, который собирается в `rows.map`, после строки `badge: \`−${discount}% (обычно ${a.median_price_rub} ₽)\`,` добавить:

```tsx
      regionNote: routeCountries(a.origin_iata, a.destination_iata),
```

- [ ] **Step 4: Render the filter and the empty states**

Заменить блок `return (…)` (строки 60–76 исходного файла) на:

```tsx
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="kicker">L3 · детектор выбросов</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
        Аномалии
      </h1>
      <p className="mt-3 max-w-md text-sm text-muted">
        Цены, рухнувшие заметно ниже своей медианы. Красная рамка — скидка ≥ 50%.
      </p>

      <AnomalyDateFilter from={range.from} to={range.to} today={today} />

      {items.length === 0 ? (
        range.active ? (
          <p className="mt-10 text-muted">
            На выбранные даты аномалий нет.{" "}
            <Link href="/anomalies" className="underline">
              Показать все
            </Link>
          </p>
        ) : (
          <p className="mt-10 text-muted">Аномалий пока нет — движок копит снапшоты ~14 дней.</p>
        )
      ) : (
        <AnomalyFeed items={items} />
      )}
    </main>
  );
}
```

- [ ] **Step 5: Verify it typechecks and lints**

Run: `pnpm typecheck && pnpm lint`
Expected: без ошибок.

- [ ] **Step 6: Commit**

```bash
git add src/app/anomalies/page.tsx
git commit -m "feat(anomalies): date-range filter on the page, past departures hidden"
```

---

### Task 6: Страны в ленте на главной

**Files:**
- Modify: `src/app/page.tsx` (импорт и три вызова)
- Modify: `src/components/deal-card.tsx` (комментарий)

- [ ] **Step 1: Swap the helper in the import**

В `src/app/page.tsx` в импорте из `@/data/airports` убрать `cityCountryName` и добавить `routeCountries`, сохранив алфавитный порядок:

```tsx
import {
  cityName,
  countryName,
  countryNameGenitive,
  isDomestic,
  routeCountries,
} from "@/data/airports";
```

- [ ] **Step 2: Replace the three call sites**

Заменить каждую из трёх строк `regionNote: cityCountryName(…)`:

| Было | Стало |
|---|---|
| `regionNote: cityCountryName(d.destination_iata),` | `regionNote: routeCountries(d.origin_iata, d.destination_iata),` |
| `regionNote: cityCountryName(p.destination),` (блок round-trip) | `regionNote: routeCountries(p.origin, p.destination),` |
| `regionNote: cityCountryName(p.destination),` (блок one-way) | `regionNote: routeCountries(p.origin, p.destination),` |

Обе строки с `p.destination` заменяются одинаково, поэтому в редакторе можно заменить все вхождения `regionNote: cityCountryName(p.destination),` разом.

- [ ] **Step 3: Update the card comment**

В `src/components/deal-card.tsx` заменить строку

```ts
  regionNote?: string; // destination country, e.g. "Турция" — shown for reference
```

на

```ts
  regionNote?: string; // route countries, e.g. "Россия → ОАЭ" — shown for reference
```

- [ ] **Step 4: Verify it typechecks and lints**

Run: `pnpm typecheck && pnpm lint`
Expected: без ошибок. Если линтер ругается на неиспользуемый `cityCountryName`, значит импорт из шага 1 не поправлен.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/components/deal-card.tsx
git commit -m "feat(feed): show both route countries in the card meta line"
```

---

### Task 7: Полная проверка

**Files:** изменений нет, только запуск проверок.

- [ ] **Step 1: Run the whole test suite**

Run: `pnpm test`
Expected: PASS, все тесты проекта зелёные, включая 8 новых в `anomaly-window.test.ts` и 4 в `airports.test.ts`.

- [ ] **Step 2: Typecheck and lint the whole project**

Run: `pnpm typecheck && pnpm lint`
Expected: без ошибок.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: сборка проходит, страница `/anomalies` собирается как динамическая (`ƒ`), потому что в файле стоит `export const dynamic = "force-dynamic"`.

- [ ] **Step 4: Manual smoke check**

Run: `pnpm dev`, открыть по очереди:

| Адрес | Что должно быть видно |
|---|---|
| `/anomalies` | Список, блок фильтра, активна кнопка «Все даты», в карточках строка вида «Россия → ОАЭ» |
| `/anomalies?from=2026-10-01&to=2026-10-31` | Только вылеты октября, поля заполнены, пресеты не подсвечены |
| Клик по «3 месяца» | Адрес меняется, поля перерисовываются, кнопка «3 месяца» подсвечена |
| `/anomalies?from=2026-10-10&to=2026-10-01` | Текст «На выбранные даты аномалий нет» и ссылка «Показать все» |
| `/anomalies?from=вчера` | Ведёт себя как без фильтра, поля пустые |
| `/` | В карточках ленты вместо одной страны пара, например «Россия → Турция» |

- [ ] **Step 5: Commit if anything was fixed**

```bash
git add -A
git commit -m "chore(anomalies): fixes from the smoke check"
```

Если правок не потребовалось, шаг пропускается.
