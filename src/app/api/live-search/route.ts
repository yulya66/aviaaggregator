import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { initSearch } from "@/lib/tp/live-search";

export const dynamic = "force-dynamic";

// Spike/debug: bearer-protected (CRON token). Inits a real flight_search and returns the raw
// response so we can validate the signature + discover the response shape against the live API.
export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (auth.replace(/^Bearer\s+/i, "") !== env.CRON_BEARER_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    origin?: string;
    destination?: string;
    departDate?: string;
  };
  const { origin, destination, departDate } = body;
  if (!origin || !destination || !departDate) {
    return NextResponse.json(
      { error: "origin, destination, departDate required" },
      { status: 400 },
    );
  }

  const userIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  try {
    const result = await initSearch({
      host: "aviatop.vercel.app",
      user_ip: userIp,
      locale: "ru",
      trip_class: "Y",
      passengers: { adults: 1, children: 0, infants: 0 },
      segments: [{ origin, destination, date: departDate }],
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
