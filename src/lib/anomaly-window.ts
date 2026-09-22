/** Query bounds for the `anomalies` table plus cleaned values for the form fields. */
export type DateWindow = {
  /** Lower bound of `depart_date` — never earlier than today. */
  gte: string;
  /** Upper bound of `depart_date`, or null when «По» is empty. */
  lte: string | null;
  /** Value for the «Вылет с» field ("" — the param was absent or invalid). */
  from: string;
  /** Value for the «По» field. */
  to: string;
  /** Whether the filter is set — only affects the empty-state text. */
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
 * URL params → query bounds. Past departures are never shown: the lower bound
 * is the max of «С» and today. «По» earlier than «С» is intentionally left
 * uncorrected — the user will see an empty list and the hint.
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
 * Preset window: `months` months ahead of today. If the target month has no
 * such day (March 31 + 1 month), it clamps to the last day of the month
 * instead of rolling into the next one.
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
