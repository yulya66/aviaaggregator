export type HttpOptions = {
  /** Total attempts (not extra retries). Default 3. */
  retries?: number;
  /** Per-attempt backoff in ms; index = attempt number. Default [1000, 3000, 9000]. */
  backoffMs?: number[];
  /** Abort each attempt after this many ms. Default 8000 (Vercel Hobby has a 10s limit). */
  timeoutMs?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson<T>(url: string, opts: HttpOptions = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  const backoff = opts.backoffMs ?? [1000, 3000, 9000];
  const timeoutMs = opts.timeoutMs ?? 8000;

  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt < retries - 1) await sleep(backoff[attempt] ?? 1000);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}
