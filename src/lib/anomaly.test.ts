import { describe, expect, it } from "vitest";
import { evaluateAnomaly } from "./anomaly";

const base = { price: 5000, median: 18000, stddev: 4000, n: 30, transfers: 1 };

describe("evaluateAnomaly", () => {
  it("flags a clear outlier and computes discount + z-score", () => {
    const result = evaluateAnomaly(base);
    expect(result).not.toBeNull();
    expect(result?.discountPct).toBeCloseTo(72.22, 1);
    expect(result?.zScore).toBeCloseTo((5000 - 18000) / 4000, 5);
  });

  it("returns null during cold start (n < 10)", () => {
    expect(evaluateAnomaly({ ...base, n: 9 })).toBeNull();
  });

  it("returns null when the median is too low (< 3000)", () => {
    expect(evaluateAnomaly({ ...base, median: 2999, price: 1500 })).toBeNull();
  });

  it("returns null when the price is below the floor (< 1000)", () => {
    expect(evaluateAnomaly({ ...base, price: 999 })).toBeNull();
  });

  it("returns null when transfers exceed 3", () => {
    expect(evaluateAnomaly({ ...base, transfers: 4 })).toBeNull();
  });

  it("returns null when the discount is below 30% (price > median*0.70)", () => {
    expect(evaluateAnomaly({ ...base, price: 13000 })).toBeNull();
  });

  it("uses z-score 0 when stddev is 0 (avoids divide-by-zero)", () => {
    const result = evaluateAnomaly({ ...base, stddev: 0 });
    expect(result?.zScore).toBe(0);
  });
});
