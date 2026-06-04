export type AnomalyStats = {
  price: number;
  median: number;
  stddev: number;
  n: number;
  transfers: number;
};

export type AnomalyVerdict = {
  discountPct: number;
  zScore: number;
};

export function evaluateAnomaly(s: AnomalyStats): AnomalyVerdict | null {
  if (s.n < 10) return null;
  if (s.median < 3000) return null;
  if (s.price < 1000) return null;
  if (s.transfers > 3) return null;
  if (s.price > s.median * 0.7) return null;

  const discountPct = ((s.median - s.price) / s.median) * 100;
  const zScore = s.stddev > 0 ? (s.price - s.median) / s.stddev : 0;
  return { discountPct, zScore };
}
