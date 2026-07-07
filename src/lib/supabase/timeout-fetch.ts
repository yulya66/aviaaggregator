/**
 * fetch with a hard timeout, wired into every Supabase server client. If Supabase
 * is unreachable (paused / IP-blocked), calls abort after a few seconds instead of
 * hanging the whole serverless function — so the site degrades rather than falling over.
 */
export function timeoutFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(4000) });
}
