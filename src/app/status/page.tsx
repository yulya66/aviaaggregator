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

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-bold">Статус</h1>

      <section className="mt-6 rounded-lg border border-gray-200 p-4">
        <h2 className="font-semibold">API-бюджет (Travelpayouts)</h2>
        <p className="mt-1 text-gray-600">
          За последние 24 часа: {apiCallsLast24h} / {API_BUDGET} вызовов
        </p>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">Cron-задачи</h2>
        <div className="mt-3 space-y-2">
          {JOBS.map((job) => {
            const run = latestByJob.get(job);
            return (
              <div
                key={job}
                className="flex items-center justify-between rounded border border-gray-200 px-4 py-2 text-sm"
              >
                <span className="font-mono">{job}</span>
                {run ? (
                  <span className={run.error ? "text-red-700" : "text-gray-600"}>
                    {run.error ? "ошибка" : "ок"} · {run.started_at} · строк: {run.rows_inserted}
                  </span>
                ) : (
                  <span className="text-gray-400">ещё не запускалась</span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
