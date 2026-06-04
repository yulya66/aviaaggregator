export type DealKind = "l1" | "l2" | "l3" | "lay";

export type AviasalesLinkParams = {
  origin: string;
  destination: string;
  departDate: string; // YYYY-MM-DD
  returnDate?: string | null; // YYYY-MM-DD
  marker: string;
  dealKind: DealKind;
  dealId: string; // UUID (with dashes)
  userId?: string | null; // UUID (with dashes)
};

/** UUID without dashes — Travelpayouts SUB_ID must not contain '-'. */
function hex(uuid: string): string {
  return uuid.replace(/-/g, "");
}

/** "2026-09-10" -> "1009" (DDMM, Aviasales search-path format). */
function ddmm(date: string): string {
  const [, month, day] = date.split("-");
  return `${day}${month}`;
}

export function buildAviasalesLink(p: AviasalesLinkParams): string {
  const out = ddmm(p.departDate);
  const ret = p.returnDate ? ddmm(p.returnDate) : "";
  const path = `${p.origin}${out}${p.destination}${ret}1`; // trailing 1 = passengers
  const userPart = p.userId ? `u${hex(p.userId)}` : "";
  const subId = `${p.dealKind}_${hex(p.dealId)}_${userPart}`;
  return `https://www.aviasales.ru/search/${path}?marker=${p.marker}.${subId}`;
}
