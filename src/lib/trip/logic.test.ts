import { describe, expect, it } from "vitest";
import { addLeg, dateConflicts, removeLeg, totalOf } from "./logic";
import type { TripLeg } from "./store";

function leg(over: Partial<TripLeg>): TripLeg {
  return {
    id: "SVX_IST_2026-09-12",
    origin: "SVX",
    destination: "IST",
    route: "Екатеринбург → Стамбул",
    dateLabel: "12.09.2026",
    departDate: "2026-09-12",
    priceRub: 15000,
    airline: "U6",
    transfers: 0,
    deepLink: "https://example.test",
    ...over,
  };
}

describe("trip logic", () => {
  it("addLeg appends a new leg", () => {
    const out = addLeg([], leg({}));
    expect(out).toHaveLength(1);
  });

  it("addLeg ignores a duplicate id (same flight twice)", () => {
    const a = leg({});
    const out = addLeg(addLeg([], a), leg({ priceRub: 99999 }));
    expect(out).toHaveLength(1);
    expect(out[0].priceRub).toBe(15000); // first one wins
  });

  it("removeLeg drops only the matching leg", () => {
    const a = leg({});
    const b = leg({ id: "IST_SVX_2026-09-20", departDate: "2026-09-20" });
    expect(removeLeg([a, b], a.id)).toEqual([b]);
  });

  it("totalOf sums leg prices", () => {
    const a = leg({ priceRub: 10000 });
    const b = leg({ id: "x", priceRub: 25000 });
    expect(totalOf([a, b])).toBe(35000);
    expect(totalOf([])).toBe(0);
  });

  it("dateConflicts flags a leg departing before the previous one", () => {
    const out1 = leg({ id: "1", departDate: "2026-09-12" });
    const back = leg({ id: "2", departDate: "2026-09-10" }); // earlier — broken chain
    expect(dateConflicts([out1, back])).toEqual([1]);
  });

  it("dateConflicts accepts same-day and ordered chains", () => {
    const a = leg({ id: "1", departDate: "2026-09-12" });
    const b = leg({ id: "2", departDate: "2026-09-12" });
    const c = leg({ id: "3", departDate: "2026-10-01" });
    expect(dateConflicts([a, b, c])).toEqual([]);
  });
});
