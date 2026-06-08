import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { isRunnableJob, runJob } from "@/lib/jobs/run";

export const dynamic = "force-dynamic";

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

  if (isRunnableJob(job)) {
    // Round-robin advances every 20 min (one slot per scheduled run); ?hour=N forces a hub.
    const hourParam = new URL(request.url).searchParams.get("hour");
    const opts = job === "poll_l3" && hourParam !== null ? { slot: Number(hourParam) } : undefined;
    try {
      const result = await runJob(job, opts);
      return NextResponse.json({ job, ...result }, { status: 200 });
    } catch (error) {
      return NextResponse.json({ job, error: String(error) }, { status: 500 });
    }
  }

  // Remaining jobs (L1, layovers, cleanup, watchdog, digest) land in later plans.
  return NextResponse.json(
    { job, status: "not_implemented", note: "Stub — implemented in later plan." },
    { status: 501 },
  );
}
