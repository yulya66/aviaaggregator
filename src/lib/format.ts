/** "2026-09-12" (or an ISO datetime) -> "12.09.2026". Returns input unchanged if not date-like. */
export function formatDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : date;
}

/**
 * Today's date in the user's timezone as "YYYY-MM-DD". Replaces
 * `toISOString().slice(0, 10)`, which returns the UTC date — in Yekaterinburg
 * (UTC+5) that lags a day behind between midnight and 5am. Both arguments are
 * explicit so the function can be tested without faking the system clock.
 */
export function todayIso(now: Date = new Date(), timeZone = "Asia/Yekaterinburg"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}
