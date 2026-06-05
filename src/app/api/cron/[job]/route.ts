import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runPollL1 } from "@/lib/jobs/l1";
import { runPollL2 } from "@/lib/jobs/l2";
import { runPollL3 } from "@/lib/jobs/l3";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { tpClient } from "@/lib/tp/client";

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

  if (job === "poll_l1" || job === "poll_l2" || job === "poll_l3") {
    const supabase = createServiceRoleClient();
    const marker = process.env.TP_PARTNER_MARKER ?? "";
    const startedAt = new Date().toISOString();
    try {
      let result: { api_calls: number; rows_inserted: number };
      if (job === "poll_l1") {
        result = await runPollL1(supabase, tpClient, marker);
      } else if (job === "poll_l2") {
        result = await runPollL2(supabase, tpClient, marker);
      } else {
        result = await runPollL3(supabase, tpClient, marker, new Date().getUTCHours());
      }

      await supabase.from("cron_runs").insert({
        job,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        api_calls: result.api_calls,
        rows_inserted: result.rows_inserted,
      });

      return NextResponse.json({ job, ...result }, { status: 200 });
    } catch (error) {
      await supabase.from("cron_runs").insert({
        job,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        error: String(error),
      });
      return NextResponse.json({ job, error: String(error) }, { status: 500 });
    }
  }

  // Remaining jobs (L1, layovers, cleanup, watchdog, digest) land in later plans.
  return NextResponse.json(
    { job, status: "not_implemented", note: "Stub — implemented in later plan." },
    { status: 501 },
  );
}
