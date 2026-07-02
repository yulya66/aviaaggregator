export type Rankable = { priceRub: number; departDate: string };

/**
 * Shared feed ranking used by the deals feed and the anomalies list.
 * - price only  → cheapest first
 * - date only   → soonest first (price breaks ties)
 * - both        → normalize price and days-away to 0..1 and rank by the sum
 *   («cheap AND soon»). `now` is injectable for deterministic tests.
 */
export function rankByToggles<T extends Rankable>(
  items: T[],
  byPrice: boolean,
  byDate: boolean,
  now = Date.now(),
): T[] {
  if (byPrice && byDate) {
    const maxPrice = Math.max(...items.map((i) => i.priceRub), 1);
    const dayMs = 24 * 60 * 60 * 1000;
    const days = (i: T) => Math.max(0, (Date.parse(i.departDate) - now) / dayMs);
    const maxDays = Math.max(...items.map(days), 1);
    const score = (i: T) => i.priceRub / maxPrice + days(i) / maxDays;
    return [...items].sort((a, b) => score(a) - score(b));
  }
  if (byDate) {
    return [...items].sort(
      (a, b) => a.departDate.localeCompare(b.departDate) || a.priceRub - b.priceRub,
    );
  }
  return [...items].sort((a, b) => a.priceRub - b.priceRub);
}
