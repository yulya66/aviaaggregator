import { describe, expect, it } from "vitest";
import { rankByToggles } from "./rank";

const NOW = Date.parse("2026-07-01");
const items = [
  { id: "cheap-far", priceRub: 5000, departDate: "2026-12-01" },
  { id: "dear-soon", priceRub: 20000, departDate: "2026-07-05" },
  { id: "mid-mid", priceRub: 12000, departDate: "2026-09-01" },
];
const ids = (r: { id: string }[]) => r.map((i) => i.id);

describe("rankByToggles", () => {
  it("price only → cheapest first", () => {
    expect(ids(rankByToggles(items, true, false, NOW))).toEqual([
      "cheap-far",
      "mid-mid",
      "dear-soon",
    ]);
  });

  it("date only → soonest first", () => {
    expect(ids(rankByToggles(items, false, true, NOW))).toEqual([
      "dear-soon",
      "mid-mid",
      "cheap-far",
    ]);
  });

  it("both → cheap-and-soon beats the extremes", () => {
    // dear-soon (soon but pricey) and cheap-far (cheap but distant) each score ~1 on one axis;
    // mid-mid balances both and should rank first.
    expect(ids(rankByToggles(items, true, true, NOW))[0]).toBe("mid-mid");
  });

  it("does not mutate the input array", () => {
    const copy = [...items];
    rankByToggles(items, true, false, NOW);
    expect(items).toEqual(copy);
  });
});
