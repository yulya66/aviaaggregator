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
  return raw.trim();
}

const NEXT_PUBLIC_SUPABASE_URL = read("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");

export const env = {
  NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: read("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: read("SUPABASE_SERVICE_ROLE_KEY"),
  CRON_BEARER_TOKEN: read("CRON_BEARER_TOKEN"),
} as const;
