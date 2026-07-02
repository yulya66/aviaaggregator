const REQUIRED_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_BEARER_TOKEN",
] as const;

type Key = (typeof REQUIRED_KEYS)[number];

function read(key: Key): string {
  const raw = process.env[key];
  if (!raw || raw.trim().length === 0) {
    throw new Error(`Missing required env var: ${key}`);
  }
  const trimmed = raw.trim();
  return key === "NEXT_PUBLIC_SUPABASE_URL" ? trimmed.replace(/\/+$/, "") : trimmed;
}

/**
 * Env is read lazily, per key, on access — not eagerly at import time. Each
 * consumer only validates the vars it actually reads, so a missing server-only
 * var (e.g. CRON_BEARER_TOKEN) can't crash unrelated code paths like the
 * request middleware, which needs only the two NEXT_PUBLIC_SUPABASE_* vars.
 */
export const env = Object.freeze(
  Object.defineProperties(
    {} as Record<Key, string>,
    Object.fromEntries(
      REQUIRED_KEYS.map((key) => [
        key,
        { enumerable: true, get: () => read(key) },
      ]),
    ),
  ),
);
