/** Route-segment loading state — skeleton shown while server fetches (TP calendar ~1–2s). */
export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="h-3 w-40 animate-pulse rounded bg-line" />
      <div className="mt-4 h-10 w-72 animate-pulse rounded bg-line" />
      <div className="mt-6 flex gap-2">
        <div className="h-9 w-32 animate-pulse rounded-full bg-line" />
        <div className="h-9 w-40 animate-pulse rounded-full bg-line" />
      </div>
      <div className="mt-6 h-24 animate-pulse rounded-card bg-line/60" />
      <p className="mt-6 font-mono text-[0.7rem] uppercase tracking-widest text-muted">
        Ищем рейсы…
      </p>
      <div className="mt-3 space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-card bg-line/60" />
        ))}
      </div>
    </main>
  );
}
