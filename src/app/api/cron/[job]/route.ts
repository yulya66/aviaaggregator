import { NextResponse } from "next/server";
import { env } from "@/lib/env";

const KNOWN_JOBS = [
  "poll_l1",
  "poll_l2",
  "poll_l3",
  "poll_vi",
  "poll_oj",
  "poll_cleanup",
  "poll_watchdog",
  "poll_digest",
] as const;

type Job = (typeof KNOWN_JOBS)[number];

function isKnownJob(j: string): j is Job {
  return (KNOWN_JOBS as readonly string[]).includes(j);
}

export async function POST(request: Request, { params }: { params: Promise<{ job: string }> }) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (token !== env.CRON_BEARER_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { job } = await params;
  if (!isKnownJob(job)) {
    return NextResponse.json({ error: "unknown_job", job }, { status: 404 });
  }

  // Each job's real implementation lands in its respective plan (L1/L2/L3/...).
  return NextResponse.json(
    { job, status: "not_implemented", note: "Stub — implemented in later plan." },
    { status: 501 },
  );
}
