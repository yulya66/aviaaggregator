import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const JOBS = [
  "poll_l2",
  "poll_l3",
  "poll_l1",
  "poll_vi",
  "poll_oj",
  "poll_cleanup",
  "poll_watchdog",
  "poll_digest",
];

export default async function StatusPage() {
  const supabase = await createClient();

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [runsRes, budgetRes] = await Promise.all([
    supabase
      .from("cron_runs")
      .select("job, started_at, finished_at, api_calls, rows_inserted, error")
      .order("started_at", { ascending: false })
      .limit(200),
    supabase.from("cron_runs").select("api_calls").gte("started_at", since),
  ]);

  const runs = runsRes.data ?? [];
  const latestByJob = new Map<string, (typeof runs)[number]>();
  for (const run of runs) {
    if (!latestByJob.has(run.job)) latestByJob.set(run.job, run);
  }

  const apiCallsLast24h = (budgetRes.data ?? []).reduce((sum, r) => sum + (r.api_calls ?? 0), 0);
  const API_BUDGET = 5000;
  const budgetPct = Math.min(100, (apiCallsLast24h / API_BUDGET) * 100);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="kicker">Observability</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
        Статус
      </h1>

      <section className="mt-8 rounded-card border border-line bg-card p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-mono text-[0.7rem] uppercase tracking-widest text-muted">
            API-бюджет · Travelpayouts
          </h2>
          <span className="font-mono text-sm tabular-nums">
            {apiCallsLast24h} / {API_BUDGET}
          </span>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${Math.max(budgetPct, 1.5)}%` }}
          />
        </div>
        <p className="mt-2 font-mono text-[0.68rem] uppercase tracking-wider text-muted">
          вызовов за 24 часа
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-mono text-[0.7rem] uppercase tracking-widest text-muted">
          Cron-задачи
        </h2>
        <div className="mt-3 divide-y divide-line overflow-hidden rounded-card border border-line bg-card">
          {JOBS.map((job) => {
            const run = latestByJob.get(job);
            const dot = !run ? "bg-line" : run.error ? "bg-accent" : "bg-sky";
            return (
              <div key={job} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="flex items-center gap-2.5 font-mono">
                  <span className={`h-2 w-2 rounded-full ${dot}`} />
                  {job}
                </span>
                {run ? (
                  <span className="font-mono text-[0.72rem] tracking-wide text-muted">
                    {run.error ? "ошибка" : "ок"} ·{" "}
                    {String(run.started_at).slice(0, 16).replace("T", " ")} · {run.rows_inserted}{" "}
                    строк
                  </span>
                ) : (
                  <span className="font-mono text-[0.72rem] tracking-wide text-muted/60">
                    не запускалась
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
