import { type NextRequest, NextResponse } from "next/server";
import { CITIES } from "@/data/cities";
import { COUNTRIES } from "@/data/countries";

export const dynamic = "force-dynamic";

type Item = { code: string; name: string; type: "city" | "country" };

// Precompute once: [code, name, lowercased name] for ranking.
const CITY_ENTRIES: Array<[string, string, string]> = Object.entries(CITIES).map(([code, name]) => [
  code,
  name,
  name.toLowerCase(),
]);
const COUNTRY_ENTRIES: Array<[string, string, string]> = Object.entries(COUNTRIES).map(
  ([code, name]) => [code, name, name.toLowerCase()],
);

const LIMIT = 12;
const byLen = (a: Item, b: Item) => a.name.length - b.name.length;

/**
 * GET /api/cities?q=ита → { items: [{ code, name, type }] }.
 * Searches cities and countries; country matches rank above cities so a
 * 2-letter destination (a country) is offered first (spec 2026-06-19).
 */
export function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  if (q.length < 2) return NextResponse.json({ items: [] });

  const qUpper = q.toUpperCase();

  const countryStarts: Item[] = [];
  const countryContains: Item[] = [];
  for (const [code, name, lower] of COUNTRY_ENTRIES) {
    if (lower.startsWith(q) || code === qUpper) countryStarts.push({ code, name, type: "country" });
    else if (lower.includes(q)) countryContains.push({ code, name, type: "country" });
  }

  const cityStarts: Item[] = [];
  const cityContains: Item[] = [];
  for (const [code, name, lower] of CITY_ENTRIES) {
    if (lower.startsWith(q) || code === qUpper) cityStarts.push({ code, name, type: "city" });
    else if (lower.includes(q)) cityContains.push({ code, name, type: "city" });
    if (cityStarts.length >= LIMIT) break;
  }

  const countries = [...countryStarts.sort(byLen), ...countryContains.sort(byLen)];
  const cities = [...cityStarts.sort(byLen), ...cityContains.sort(byLen)];
  const items = [...countries, ...cities].slice(0, LIMIT);
  return NextResponse.json({ items });
}
