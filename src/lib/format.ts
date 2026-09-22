/** "2026-09-12" (or an ISO datetime) -> "12.09.2026". Returns input unchanged if not date-like. */
export function formatDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : date;
}

/**
 * Сегодняшняя дата в часовом поясе пользователя как "ГГГГ-ММ-ДД". Нужна вместо
 * `toISOString().slice(0, 10)`: та отдаёт дату по UTC, и в Екатеринбурге (UTC+5)
 * с полуночи до пяти утра она отстаёт на сутки. Параметры принимаются явно,
 * чтобы функцию можно было проверить тестами без подмены системного времени.
 */
export function todayIso(now: Date = new Date(), timeZone = "Asia/Yekaterinburg"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}
