/** "2026-09-12" (or an ISO datetime) -> "12.09.2026". Returns input unchanged if not date-like. */
export function formatDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : date;
}
