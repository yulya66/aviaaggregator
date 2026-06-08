import { createServiceRoleClient } from "@/lib/supabase/server";
import { tpClient } from "@/lib/tp/client";
import { runPollL1 } from "./l1";
import { runPollL2 } from "./l2";
import { runPollL3 } from "./l3";

export const RUNNABLE_JOBS = ["poll_l1", "poll_l2", "poll_l3"] as const;
export type RunnableJob = (typeof RUNNABLE_JOBS)[number];

export function isRunnableJob(j: string): j is RunnableJob {
  return (RUNNABLE_JOBS as readonly string[]).includes(j);
}

export type JobOutcome = {
  api_calls: number;
  rows_inserted: number;
  anomalies_detected?: number;
};

/**
 * Run one poll job with the service-role client, record a cron_runs row, and
 * return its result. Shared by the cron route (Bearer-auth) and the admin
 * "run now" buttons. For poll_l3, `opts.slot` overrides the round-robin hub.
 */
export async function runJob(job: RunnableJob, opts?: { slot?: number }): Promise<JobOutcome> {
  const supabase = createServiceRoleClient();
  const marker = process.env.TP_PARTNER_MARKER ?? "";
  const startedAt = new Date().toISOString();
  try {
    let result: JobOutcome;
    if (job === "poll_l1") {
      result = await runPollL1(supabase, tpClient, marker);
    } else if (job === "poll_l2") {
      result = await runPollL2(supabase, tpClient, marker);
    } else {
      const slot = opts?.slot ?? Math.floor(Date.now() / (20 * 60 * 1000));
      result = await runPollL3(supabase, tpClient, marker, slot);
    }

    await supabase.from("cron_runs").insert({
      job,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      api_calls: result.api_calls,
      rows_inserted: result.rows_inserted,
    });
    return result;
  } catch (error) {
    await supabase.from("cron_runs").insert({
      job,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      error: String(error),
    });
    throw error;
  }
}
