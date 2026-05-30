# Авиа-агрегатор

Личный мониторинг дешёвых авиабилетов и интересных стыковок. См. полный дизайн в [docs/superpowers/specs/2026-05-21-aviaaggregator-design.md](docs/superpowers/specs/2026-05-21-aviaaggregator-design.md).

## Local setup

### Prereqs
- Node.js 20+, pnpm 9+, Docker Desktop, Git

### First-time setup

```bash
# 1. Install dependencies
pnpm install

# 2. Start local Supabase (Postgres + Auth + Inbucket)
pnpm dlx supabase start

# 3. Copy .env.example -> .env.local and paste keys from `supabase start` output
cp .env.example .env.local
# edit .env.local

# 4. Apply migrations
pnpm dlx supabase db reset

# 5. Run dev server
pnpm dev
```

Open http://localhost:3000.
Local email inbox (for magic-link testing): http://127.0.0.1:54324.

### Scripts
- `pnpm dev` — Next.js dev server
- `pnpm build` — production build
- `pnpm lint` — Biome check
- `pnpm lint:fix` — Biome check + auto-fix
- `pnpm typecheck` — TypeScript noEmit pass
- `pnpm test` — Vitest run
- `pnpm test:watch` — Vitest watch mode

## Deployment

Hosted on Vercel (Hobby tier). Database: Supabase Cloud (free tier).
Cron jobs run on GitHub Actions and POST to `/api/cron/[job]`.

### Required Vercel env vars
See `.env.example` — all `NEXT_PUBLIC_*`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_BEARER_TOKEN`. Travelpayouts and Resend keys are added in later plans.

### Required GH Actions secrets
- `CRON_BEARER_TOKEN` — same value as Vercel env
- `SITE_URL` — e.g. `https://your-project.vercel.app`
