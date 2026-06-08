import { type NextRequest, NextResponse } from "next/server";
import { CITIES } from "@/data/cities";

export const dynamic = "force-dynamic";

// Precompute once: [code, name, lowercased name] for ranking.
const ENTRIES: Array<[string, string, string]> = Object.entries(CITIES).map(([code, name]) => [
  code,
  name,
  name.toLowerCase(),
]);

const LIMIT = 12;

/** GET /api/cities?q=соч → { items: [{ code, name }] } ranked by relevance. */
export function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  if (q.length < 2) return NextResponse.json({ items: [] });

  const qUpper = q.toUpperCase();
  const starts: Array<{ code: string; name: string }> = [];
  const contains: Array<{ code: string; name: string }> = [];

  for (const [code, name, lower] of ENTRIES) {
    if (lower.startsWith(q) || code === qUpper) {
      starts.push({ code, name });
    } else if (lower.includes(q)) {
      contains.push({ code, name });
    }
    if (starts.length >= LIMIT) break;
  }

  const byLen = (a: { name: string }, b: { name: string }) => a.name.length - b.name.length;
  const items = [...starts.sort(byLen), ...contains.sort(byLen)].slice(0, LIMIT);
  return NextResponse.json({ items });
}
