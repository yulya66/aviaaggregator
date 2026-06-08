/**
 * Admin allowlist. Set ADMIN_EMAILS in the environment (comma-separated) to the
 * email(s) that may see the admin area. Unset → no admins (safe default).
 * Server-only — never import into a client component.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
