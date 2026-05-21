# Plan 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Next.js + Supabase + Vercel + GH Actions skeleton so that subsequent plans (L2/L3, L1, layovers, monetization, polishing) can add features against a working foundation: login with magic link, deployed HTTPS site, working CI, empty cron-job stubs, healthy Supabase connection.

**Architecture:** Next.js 15 App Router on Vercel Hobby. Supabase Postgres + Auth + RLS, accessed via `@supabase/ssr` for both RSC and API routes. GH Actions CI for lint/typecheck/test/build. GH Actions cron stubs that authenticate to Vercel routes via Bearer token (the routes return `501` until L2/L3 plans land).

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind CSS v4, Biome, Vitest, pnpm, `@supabase/ssr`, `@supabase/supabase-js`, Supabase CLI.

**Spec reference:** `docs/superpowers/specs/2026-05-21-aviaaggregator-design.md`

---

## File structure after this plan

```
.
├── .env.example
├── .github/workflows/
│   ├── ci.yml                 # PR checks: lint + typecheck + test + build
│   ├── cron-l1.yml            # stub — POST /api/cron/poll_l1
│   ├── cron-l2.yml            # stub — POST /api/cron/poll_l2
│   ├── cron-l3.yml            # stub — POST /api/cron/poll_l3
│   ├── cron-vi.yml            # stub
│   ├── cron-oj.yml            # stub
│   ├── cron-cleanup.yml       # stub
│   ├── cron-watchdog.yml      # stub
│   └── cron-digest.yml        # stub
├── biome.json
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
├── postcss.config.mjs
├── tsconfig.json
├── vitest.config.ts
├── README.md
├── supabase/
│   ├── config.toml
│   └── migrations/
│       └── 20260521000001_initial.sql   # profiles + RLS + helper functions
├── tests/
│   └── setup.ts
└── src/
    ├── middleware.ts                    # auth refresh
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx                   # root layout + nav
    │   ├── page.tsx                     # home placeholder
    │   ├── auth/
    │   │   ├── login/page.tsx
    │   │   └── callback/route.ts
    │   └── api/
    │       ├── health/route.ts
    │       └── cron/
    │           └── [job]/route.ts       # 501 stub with Bearer check
    ├── components/
    │   └── nav.tsx
    └── lib/
        ├── env.ts                       # typed env access
        └── supabase/
            ├── client.ts                # browser client
            ├── server.ts                # server client (RSC + API)
            └── middleware.ts            # auth middleware helper
```

---

## Prereqs (one-time, user-side — verify before starting)

The engineer needs the following installed locally:
- **Node.js 20+** (`node -v`)
- **pnpm 9+** (`pnpm -v`; install with `npm i -g pnpm` if missing)
- **Docker Desktop** (for Supabase local dev)
- **Supabase CLI** invoked via `pnpm dlx supabase` (no global install needed)
- **Git** (already installed since spec was committed)

**Corporate proxy note (user's environment):** the user is behind a corporate Squid proxy at `192.168.40.250:3128`. If pnpm install times out, configure:
```powershell
pnpm config set proxy http://192.168.40.250:3128
pnpm config set https-proxy http://192.168.40.250:3128
```

---

## Task 1: Initialize pnpm + Next.js 15 + TypeScript

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`

- [ ] **Step 1: Initialize pnpm workspace**

Run from project root:
```powershell
pnpm init
```
Expected: creates `package.json`.

- [ ] **Step 2: Install Next.js, React, TypeScript**

```powershell
pnpm add next@15 react@19 react-dom@19
pnpm add -D typescript @types/node @types/react @types/react-dom
```
Expected: installs without errors, `pnpm-lock.yaml` created.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { typedRoutes: true },
};

export default nextConfig;
```

- [ ] **Step 5: Add scripts to `package.json`**

Edit `package.json` to set:
```json
{
  "name": "aviaaggregator",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit"
  }
}
```
(Keep existing `dependencies` / `devDependencies` fields.)

- [ ] **Step 6: Create root layout `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Авиа-агрегатор",
  description: "Личный мониторинг дешёвых авиабилетов",
};

export default function RootLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 7: Create home placeholder `src/app/page.tsx`**

```tsx
export default function HomePage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Авиа-агрегатор</h1>
      <p className="mt-2 text-gray-600">
        Дашборд появится после Plan 2. Сейчас работает только скелет.
      </p>
    </main>
  );
}
```

- [ ] **Step 8: Create `src/app/globals.css`** (Tailwind будет настроен в Task 3, пока пустой)

```css
/* Tailwind directives will be added in Task 3 */
```

- [ ] **Step 9: Verify dev server**

```powershell
pnpm dev
```
Open `http://localhost:3000`, ожидаемо: заголовок «Авиа-агрегатор», без ошибок в консоли. Остановить (Ctrl+C).

- [ ] **Step 10: Verify typecheck**

```powershell
pnpm typecheck
```
Expected: no errors.

- [ ] **Step 11: Commit**

```powershell
git add package.json pnpm-lock.yaml tsconfig.json next.config.ts src/
git commit -m "chore: scaffold Next.js 15 + TypeScript skeleton"
```

---

## Task 2: Add Biome (lint + format)

**Files:**
- Create: `biome.json`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Install Biome**

```powershell
pnpm add -D --save-exact @biomejs/biome
```

- [ ] **Step 2: Create `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": { "ignoreUnknown": true, "ignore": [".next", "node_modules", "supabase/.branches"] },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": { "noNonNullAssertion": "off", "useImportType": "warn" },
      "suspicious": { "noExplicitAny": "warn" }
    }
  },
  "javascript": { "formatter": { "quoteStyle": "double", "trailingCommas": "all", "semicolons": "always" } }
}
```

- [ ] **Step 3: Add lint/format scripts to `package.json`**

Add to the `scripts` block:
```json
"lint": "biome check .",
"lint:fix": "biome check --write .",
"format": "biome format --write ."
```

- [ ] **Step 4: Run lint to verify clean baseline**

```powershell
pnpm lint:fix
pnpm lint
```
Expected: no errors after fix.

- [ ] **Step 5: Commit**

```powershell
git add biome.json package.json pnpm-lock.yaml
git commit -m "chore: add Biome for lint and format"
```

---

## Task 3: Add Tailwind CSS v4

**Files:**
- Create: `postcss.config.mjs`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Install Tailwind v4 + PostCSS plugin**

```powershell
pnpm add -D tailwindcss@4 @tailwindcss/postcss@4
```

- [ ] **Step 2: Create `postcss.config.mjs`**

```javascript
export default {
  plugins: { "@tailwindcss/postcss": {} },
};
```

- [ ] **Step 3: Replace `src/app/globals.css` with Tailwind v4 import**

```css
@import "tailwindcss";

:root {
  color-scheme: light;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
}
```

- [ ] **Step 4: Verify utility classes work**

```powershell
pnpm dev
```
Open `http://localhost:3000`, заголовок должен быть жирным и иметь отступ — это значит классы `text-2xl font-bold p-8` отрабатывают. Стоп (Ctrl+C).

- [ ] **Step 5: Verify build**

```powershell
pnpm build
```
Expected: build succeeds with `✓ Compiled successfully`.

- [ ] **Step 6: Commit**

```powershell
git add postcss.config.mjs src/app/globals.css package.json pnpm-lock.yaml
git commit -m "chore: add Tailwind CSS v4"
```

---

## Task 4: Set up Vitest + Testing Library

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `tests/sanity.test.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Install Vitest and friends**

```powershell
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 3: Create `tests/setup.ts`**

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Add scripts to `package.json`**

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Write sanity test `tests/sanity.test.ts`**

```typescript
import { describe, expect, it } from "vitest";

describe("sanity", () => {
  it("arithmetic still works", () => {
    expect(2 + 2).toBe(4);
  });
});
```

- [ ] **Step 6: Run tests**

```powershell
pnpm test
```
Expected: `1 passed`.

- [ ] **Step 7: Commit**

```powershell
git add vitest.config.ts tests/ package.json pnpm-lock.yaml
git commit -m "chore: add Vitest with testing-library"
```

---

## Task 5: Typed env helper (TDD)

**Files:**
- Create: `src/lib/env.ts`
- Create: `src/lib/env.test.ts`

- [ ] **Step 1: Write failing test `src/lib/env.test.ts`**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const REQUIRED = {
  NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  CRON_BEARER_TOKEN: "cron-token",
};

describe("env", () => {
  const ORIGINAL = { ...process.env };

  beforeEach(() => {
    for (const [k, v] of Object.entries(REQUIRED)) process.env[k] = v;
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it("returns all required vars when present", async () => {
    const { env } = await import("./env");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://test.supabase.co");
    expect(env.CRON_BEARER_TOKEN).toBe("cron-token");
  });

  it("throws if a required var is missing", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    await expect(import("./env")).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("normalizes trailing slash on Supabase URL", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co/";
    const { env } = await import("./env");
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://test.supabase.co");
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```powershell
pnpm test src/lib/env.test.ts
```
Expected: FAIL — `Cannot find module './env'`.

- [ ] **Step 3: Implement `src/lib/env.ts`**

```typescript
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
```

- [ ] **Step 4: Run tests again**

```powershell
pnpm test src/lib/env.test.ts
```
Expected: `3 passed`.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/env.ts src/lib/env.test.ts
git commit -m "feat(env): typed env helper with required-var validation"
```

---

## Task 6: `.env.example`

**Files:**
- Create: `.env.example`

- [ ] **Step 1: Create `.env.example`**

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace-me
SUPABASE_SERVICE_ROLE_KEY=replace-me-keep-secret

# Cron auth — generate with: openssl rand -hex 32
CRON_BEARER_TOKEN=replace-with-random-hex

# Travelpayouts (Plan 2 onwards)
# TP_API_KEY=
# TP_PARTNER_MARKER=
# TP_WEBHOOK_SECRET=

# Resend (Plan 3 onwards)
# RESEND_API_KEY=
# RESEND_WEBHOOK_SECRET=
```

- [ ] **Step 2: Verify `.env.example` is not gitignored**

```powershell
git check-ignore .env.example
```
Expected: command exits 1 (file is NOT ignored — `.gitignore` already has `!.env.example`).

- [ ] **Step 3: Commit**

```powershell
git add .env.example
git commit -m "docs: add .env.example with required and future vars"
```

---

## Task 7: Supabase local init + first migration

**Files:**
- Create: `supabase/config.toml` (via CLI init)
- Create: `supabase/migrations/20260521000001_initial.sql`

- [ ] **Step 1: Initialize Supabase locally**

```powershell
pnpm dlx supabase init
```
Expected: creates `supabase/config.toml` and supporting directories. If asked about VS Code settings: answer N.

- [ ] **Step 2: Start local Supabase stack**

```powershell
pnpm dlx supabase start
```
Expected: Docker pulls/starts containers; final output shows:
- `API URL: http://127.0.0.1:54321`
- `anon key: eyJ...`
- `service_role key: eyJ...`

Save those keys — they go into `.env.local` in Step 7.

- [ ] **Step 3: Create initial migration file**

```powershell
pnpm dlx supabase migration new initial
```
This creates `supabase/migrations/<timestamp>_initial.sql`. Rename if needed so the timestamp prefix is **`20260521000001`** (sortable). On Windows:
```powershell
Get-ChildItem supabase/migrations | Rename-Item -NewName { "20260521000001_initial.sql" }
```

- [ ] **Step 4: Write initial migration content**

Replace contents of `supabase/migrations/20260521000001_initial.sql`:

```sql
-- 20260521000001_initial.sql
-- Profiles table (extension of auth.users) + RLS + auto-create trigger

create table public.profiles (
  user_id           uuid        primary key references auth.users(id) on delete cascade,
  role              text        not null default 'user' check (role in ('user','admin')),
  notify_anomalies  boolean     not null default false,
  notify_digest     boolean     not null default false,
  has_schengen      boolean     not null default false,
  timezone          text        not null default 'Europe/Moscow',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- Auto-create profile when a new auth.users row is inserted
create or replace function public.tg_create_profile_for_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_create_profile_for_new_user();

-- RLS
alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- [ ] **Step 5: Apply migration to local Supabase**

```powershell
pnpm dlx supabase db reset
```
Expected: drops and recreates the local DB, applies all migrations, output ends with `Finished supabase db reset`.

- [ ] **Step 6: Verify table exists**

```powershell
pnpm dlx supabase db diff --schema public --use-migra
```
Expected: empty output (no diff between migrations and DB).

- [ ] **Step 7: Create `.env.local` with local Supabase credentials**

Copy keys from Step 2 into a new `.env.local` (gitignored by default):
```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste anon key from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<paste service_role key from supabase start>
CRON_BEARER_TOKEN=local-dev-token-for-cron
```

- [ ] **Step 8: Commit**

```powershell
git add supabase/
git commit -m "feat(db): initial migration with profiles, RLS, and auto-create trigger"
```

---

## Task 8: Supabase client wrappers

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/middleware.ts`

- [ ] **Step 1: Install Supabase SSR packages**

```powershell
pnpm add @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Create browser client `src/lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export function createClient() {
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
```

- [ ] **Step 3: Create server client `src/lib/supabase/server.ts`**

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — refresh happens in middleware.
          }
        },
      },
    },
  );
}

export function createServiceRoleClient() {
  // For cron jobs that bypass RLS. Never expose to the browser.
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      cookies: { getAll: () => [], setAll: () => {} },
    },
  );
}
```

- [ ] **Step 4: Create middleware helper `src/lib/supabase/middleware.ts`**

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  await supabase.auth.getUser();
  return response;
}
```

- [ ] **Step 5: Lint and typecheck**

```powershell
pnpm lint
pnpm typecheck
```
Expected: clean.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/supabase/ package.json pnpm-lock.yaml
git commit -m "feat(supabase): browser/server clients and middleware helper"
```

---

## Task 9: Auth middleware

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create `src/middleware.ts`**

```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image, favicon
     * - Image extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 2: Verify dev server runs without errors**

```powershell
pnpm dev
```
Open `http://localhost:3000` — page renders, no middleware errors in terminal. Stop (Ctrl+C).

- [ ] **Step 3: Commit**

```powershell
git add src/middleware.ts
git commit -m "feat(auth): add Next.js middleware to refresh Supabase session"
```

---

## Task 10: Magic-link login page

**Files:**
- Create: `src/app/auth/login/page.tsx`
- Create: `src/app/auth/login/actions.ts`

- [ ] **Step 1: Create server action `src/app/auth/login/actions.ts`**

```typescript
"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type LoginState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email.includes("@")) {
    return { status: "error", message: "Введите корректный email" };
  }
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { status: "error", message: error.message };
  return { status: "sent", email };
}
```

- [ ] **Step 2: Create login page `src/app/auth/login/page.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { type LoginState, sendMagicLink } from "./actions";

const INITIAL: LoginState = { status: "idle" };

export default function LoginPage() {
  const [state, action, pending] = useActionState(sendMagicLink, INITIAL);

  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-bold">Вход</h1>
      <p className="mt-2 text-gray-600">
        Введите email — пришлём ссылку для входа.
      </p>
      <form action={action} className="mt-6 space-y-3">
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {pending ? "Отправляем..." : "Получить ссылку"}
        </button>
      </form>

      {state.status === "sent" && (
        <p className="mt-4 text-green-700">
          Ссылка отправлена на {state.email}. Проверьте почту.
        </p>
      )}
      {state.status === "error" && (
        <p className="mt-4 text-red-700">{state.message}</p>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Verify in browser**

```powershell
pnpm dev
```
Open `http://localhost:3000/auth/login`. Введи любой email, нажми кнопку. Письмо в локальной разработке Supabase ловится в Inbucket (UI: `http://127.0.0.1:54324`). Стоп.

- [ ] **Step 4: Commit**

```powershell
git add src/app/auth/login/
git commit -m "feat(auth): magic-link login page with server action"
```

---

## Task 11: Auth callback route

**Files:**
- Create: `src/app/auth/callback/route.ts`

- [ ] **Step 1: Create callback `src/app/auth/callback/route.ts`**

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=invalid_code`);
}
```

- [ ] **Step 2: Verify full login flow**

`pnpm dev` → `/auth/login` → submit → откройте Inbucket (`http://127.0.0.1:54324`), кликните magic-link в письме → должны попасть обратно на `/` и быть залогинены.

- [ ] **Step 3: Commit**

```powershell
git add src/app/auth/callback/
git commit -m "feat(auth): magic-link callback route exchanges code for session"
```

---

## Task 12: Nav component with auth-aware UI

**Files:**
- Create: `src/components/nav.tsx`
- Modify: `src/app/layout.tsx`
- Create: `src/app/auth/logout/route.ts`

- [ ] **Step 1: Create `src/components/nav.tsx`**

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function Nav() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <header className="border-b border-gray-200">
      <nav className="mx-auto flex max-w-5xl items-center justify-between p-4">
        <Link href="/" className="font-bold">Авиа-агрегатор</Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/status" className="text-gray-600 hover:text-black">Статус</Link>
          {user ? (
            <>
              <span className="text-gray-600">{user.email}</span>
              <form action="/auth/logout" method="post">
                <button type="submit" className="text-gray-600 hover:text-black">Выход</button>
              </form>
            </>
          ) : (
            <Link href="/auth/login" className="text-gray-600 hover:text-black">Вход</Link>
          )}
        </div>
      </nav>
    </header>
  );
}
```

- [ ] **Step 2: Update `src/app/layout.tsx` to render Nav**

```tsx
import type { Metadata } from "next";
import { Nav } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Авиа-агрегатор",
  description: "Личный мониторинг дешёвых авиабилетов",
};

export default function RootLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Nav />
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Create logout route `src/app/auth/logout/route.ts`**

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/`, { status: 303 });
}
```

- [ ] **Step 4: Verify in browser**

`pnpm dev` → home shows "Вход" when logged out, email + "Выход" when logged in. Кнопка «Выход» работает.

- [ ] **Step 5: Commit**

```powershell
git add src/components/nav.tsx src/app/layout.tsx src/app/auth/logout/
git commit -m "feat(ui): nav with auth-aware login/logout"
```

---

## Task 13: `/api/health` endpoint with tests

**Files:**
- Create: `src/app/api/health/route.ts`
- Create: `src/app/api/health/route.test.ts`

- [ ] **Step 1: Write failing test `src/app/api/health/route.test.ts`**

```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({
    from: () => ({
      select: () => ({
        limit: () => Promise.resolve({ error: null, data: [{ user_id: "00000000-0000-0000-0000-000000000000" }] }),
      }),
    }),
  }),
  createClient: vi.fn(),
}));

describe("GET /api/health", () => {
  it("returns 200 with status ok and db reachable", async () => {
    const { GET } = await import("./route");
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.db).toBe("reachable");
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```powershell
pnpm test src/app/api/health/route.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/app/api/health/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("profiles").select("user_id").limit(1);

  return NextResponse.json({
    status: "ok",
    db: error ? "unreachable" : "reachable",
    db_error: error?.message,
    timestamp: new Date().toISOString(),
  }, { status: error ? 503 : 200 });
}
```

- [ ] **Step 4: Run tests**

```powershell
pnpm test src/app/api/health/route.test.ts
```
Expected: PASS.

- [ ] **Step 5: Manual smoke against local Supabase**

`pnpm dev` → open `http://localhost:3000/api/health` → expect JSON `{"status":"ok","db":"reachable",...}`.

- [ ] **Step 6: Commit**

```powershell
git add src/app/api/health/
git commit -m "feat(api): /api/health endpoint with Supabase reachability check"
```

---

## Task 14: Cron stub endpoint with Bearer auth (TDD)

**Files:**
- Create: `src/app/api/cron/[job]/route.ts`
- Create: `src/app/api/cron/[job]/route.test.ts`

- [ ] **Step 1: Write failing tests `src/app/api/cron/[job]/route.test.ts`**

```typescript
import { describe, expect, it, beforeEach, vi } from "vitest";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  process.env.CRON_BEARER_TOKEN = "secret-token";
  vi.resetModules();
});

function makeRequest(token: string | null, job = "poll_l2") {
  const headers = new Headers();
  if (token !== null) headers.set("authorization", `Bearer ${token}`);
  return new Request(`http://localhost/api/cron/${job}`, { method: "POST", headers });
}

describe("POST /api/cron/[job]", () => {
  it("returns 401 when no Bearer token is provided", async () => {
    const { POST } = await import("./route");
    const req = makeRequest(null);
    const res = await POST(req, { params: Promise.resolve({ job: "poll_l2" }) });
    expect(res.status).toBe(401);
  });

  it("returns 401 when Bearer token mismatches", async () => {
    const { POST } = await import("./route");
    const req = makeRequest("wrong-token");
    const res = await POST(req, { params: Promise.resolve({ job: "poll_l2" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown job names", async () => {
    const { POST } = await import("./route");
    const req = makeRequest("secret-token", "poll_unknown");
    const res = await POST(req, { params: Promise.resolve({ job: "poll_unknown" }) });
    expect(res.status).toBe(404);
  });

  it("returns 501 for known job stubs", async () => {
    const { POST } = await import("./route");
    const req = makeRequest("secret-token", "poll_l2");
    const res = await POST(req, { params: Promise.resolve({ job: "poll_l2" }) });
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.job).toBe("poll_l2");
  });
});
```

- [ ] **Step 2: Run tests — confirm failure**

```powershell
pnpm test src/app/api/cron
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/app/api/cron/[job]/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { env } from "@/lib/env";

const KNOWN_JOBS = [
  "poll_l1",
  "poll_l2",
  "poll_l3",
  "poll_vi",
  "poll_oj",
  "poll_cleanup",
  "poll_watchdog",
  "poll_digest",
] as const;

type Job = (typeof KNOWN_JOBS)[number];

function isKnownJob(j: string): j is Job {
  return (KNOWN_JOBS as readonly string[]).includes(j);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ job: string }> },
) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (token !== env.CRON_BEARER_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { job } = await params;
  if (!isKnownJob(job)) {
    return NextResponse.json({ error: "unknown_job", job }, { status: 404 });
  }

  // Each job's real implementation lands in its respective plan (L1/L2/L3/...).
  return NextResponse.json(
    { job, status: "not_implemented", note: "Stub — implemented in later plan." },
    { status: 501 },
  );
}
```

- [ ] **Step 4: Run tests**

```powershell
pnpm test src/app/api/cron
```
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```powershell
git add src/app/api/cron/
git commit -m "feat(cron): /api/cron/[job] stub with Bearer auth and known-job whitelist"
```

---

## Task 15: GH Actions CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
    branches: [main, master]
  push:
    branches: [main, master]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      - name: Unit tests
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://ci.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ci-anon
          SUPABASE_SERVICE_ROLE_KEY: ci-service
          CRON_BEARER_TOKEN: ci-cron-token
        run: pnpm test

      - name: Build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://ci.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ci-anon
          SUPABASE_SERVICE_ROLE_KEY: ci-service
          CRON_BEARER_TOKEN: ci-cron-token
        run: pnpm build
```

- [ ] **Step 2: Commit**

```powershell
git add .github/workflows/ci.yml
git commit -m "ci: lint + typecheck + test + build on PR and push"
```

---

## Task 16: GH Actions cron workflow stubs (8 files)

**Files:**
- Create: `.github/workflows/cron-l1.yml`
- Create: `.github/workflows/cron-l2.yml`
- Create: `.github/workflows/cron-l3.yml`
- Create: `.github/workflows/cron-vi.yml`
- Create: `.github/workflows/cron-oj.yml`
- Create: `.github/workflows/cron-cleanup.yml`
- Create: `.github/workflows/cron-watchdog.yml`
- Create: `.github/workflows/cron-digest.yml`

**Important:** In each stub, `schedule:` is **commented out** so the workflows do not auto-fire on `main` and turn the Actions tab red (the endpoint returns 501 until the relevant feature plan lands). Each later plan uncomments the `schedule:` block for its specific job. Stubs remain `workflow_dispatch` so they can be manually triggered for smoke-testing.

- [ ] **Step 1: Create `.github/workflows/cron-l1.yml`**

```yaml
name: Cron — L1 saved searches

on:
  # schedule:
  #   - cron: "0 */6 * * *"   # 4x/day: 00:00, 06:00, 12:00, 18:00 UTC — uncomment in Plan 3
  workflow_dispatch:

jobs:
  poll:
    runs-on: ubuntu-latest
    steps:
      - name: Invoke poll_l1
        run: |
          curl --fail-with-body -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_BEARER_TOKEN }}" \
            "${{ secrets.SITE_URL }}/api/cron/poll_l1"
```

- [ ] **Step 2: Create `.github/workflows/cron-l2.yml`** — identical structure, swap `poll_l1` → `poll_l2`, name "L2 deal feed"

```yaml
name: Cron — L2 deal feed

on:
  # schedule:
  #   - cron: "30 */6 * * *"   # 4x/day, offset 30m from L1 — uncomment in Plan 2
  workflow_dispatch:

jobs:
  poll:
    runs-on: ubuntu-latest
    steps:
      - name: Invoke poll_l2
        run: |
          curl --fail-with-body -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_BEARER_TOKEN }}" \
            "${{ secrets.SITE_URL }}/api/cron/poll_l2"
```

- [ ] **Step 3: Create `.github/workflows/cron-l3.yml`**

```yaml
name: Cron — L3 anomaly engine

on:
  # schedule:
  #   - cron: "5 * * * *"   # hourly at :05 — uncomment in Plan 2
  workflow_dispatch:

jobs:
  poll:
    runs-on: ubuntu-latest
    steps:
      - name: Invoke poll_l3
        run: |
          curl --fail-with-body -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_BEARER_TOKEN }}" \
            "${{ secrets.SITE_URL }}/api/cron/poll_l3"
```

- [ ] **Step 4: Create `.github/workflows/cron-vi.yml`**

```yaml
name: Cron — Virtual interlining

on:
  # schedule:
  #   - cron: "15 2 * * *"   # daily 02:15 UTC — uncomment in Plan 4
  workflow_dispatch:

jobs:
  poll:
    runs-on: ubuntu-latest
    steps:
      - name: Invoke poll_vi
        run: |
          curl --fail-with-body -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_BEARER_TOKEN }}" \
            "${{ secrets.SITE_URL }}/api/cron/poll_vi"
```

- [ ] **Step 5: Create `.github/workflows/cron-oj.yml`**

```yaml
name: Cron — Open-jaw

on:
  # schedule:
  #   - cron: "45 2 * * *"   # daily 02:45 UTC — uncomment in Plan 4
  workflow_dispatch:

jobs:
  poll:
    runs-on: ubuntu-latest
    steps:
      - name: Invoke poll_oj
        run: |
          curl --fail-with-body -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_BEARER_TOKEN }}" \
            "${{ secrets.SITE_URL }}/api/cron/poll_oj"
```

- [ ] **Step 6: Create `.github/workflows/cron-cleanup.yml`**

```yaml
name: Cron — Cleanup

on:
  # schedule:
  #   - cron: "0 3 * * 0"   # weekly Sun 03:00 UTC — uncomment in Plan 6
  workflow_dispatch:

jobs:
  poll:
    runs-on: ubuntu-latest
    steps:
      - name: Invoke poll_cleanup
        run: |
          curl --fail-with-body -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_BEARER_TOKEN }}" \
            "${{ secrets.SITE_URL }}/api/cron/poll_cleanup"
```

- [ ] **Step 7: Create `.github/workflows/cron-watchdog.yml`**

```yaml
name: Cron — Watchdog

on:
  # schedule:
  #   - cron: "0 6 * * *"   # daily 06:00 UTC (09:00 MSK) — uncomment in Plan 6
  workflow_dispatch:

jobs:
  poll:
    runs-on: ubuntu-latest
    steps:
      - name: Invoke poll_watchdog
        run: |
          curl --fail-with-body -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_BEARER_TOKEN }}" \
            "${{ secrets.SITE_URL }}/api/cron/poll_watchdog"
```

- [ ] **Step 8: Create `.github/workflows/cron-digest.yml`**

```yaml
name: Cron — Weekly digest

on:
  # schedule:
  #   - cron: "0 6 * * 0"   # Sun 06:00 UTC (09:00 MSK) — uncomment in Plan 6
  workflow_dispatch:

jobs:
  poll:
    runs-on: ubuntu-latest
    steps:
      - name: Invoke poll_digest
        run: |
          curl --fail-with-body -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_BEARER_TOKEN }}" \
            "${{ secrets.SITE_URL }}/api/cron/poll_digest"
```

- [ ] **Step 9: Commit all eight cron workflows**

```powershell
git add .github/workflows/cron-*.yml
git commit -m "ci: scaffold 8 cron workflows that POST to /api/cron/[job] with Bearer auth"
```

---

## Task 17: README with setup instructions

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

````markdown
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
````

- [ ] **Step 2: Commit**

```powershell
git add README.md
git commit -m "docs: add README with local setup and deploy notes"
```

---

## Task 18: Vercel deployment (manual + smoke)

**Files:** none (configuration via Vercel web UI)

This task is manual — the engineer logs into Vercel and connects the repo. It cannot be fully automated from a plan file.

- [ ] **Step 1: Push to GitHub**

If a GitHub remote doesn't exist yet:
```powershell
# Replace with your actual repo URL (must be PUBLIC per spec — for unlimited GH Actions minutes)
git remote add origin https://github.com/<your-user>/aviaaggregator.git
git branch -M main
git push -u origin main
```

- [ ] **Step 2: Create Supabase Cloud project**

1. Sign up / log in at https://supabase.com/dashboard
2. Create new project, region `eu-central-1` (Frankfurt) or `eu-west-1`
3. Save **Project URL**, **anon key**, **service_role key**
4. From local: `pnpm dlx supabase link --project-ref <project-ref>` then `pnpm dlx supabase db push` to apply migrations to cloud

- [ ] **Step 3: Connect repo to Vercel**

1. Log in at https://vercel.com → "Add New Project" → import the GitHub repo
2. Framework preset: Next.js (auto-detected)
3. Build command: `pnpm build` (default)
4. Output: `.next` (default)

- [ ] **Step 4: Configure Vercel env vars**

In Vercel project → Settings → Environment Variables, add (Production + Preview):
- `NEXT_PUBLIC_SUPABASE_URL` — from Supabase Cloud
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase Cloud
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase Cloud (mark Sensitive)
- `CRON_BEARER_TOKEN` — generate fresh: `openssl rand -hex 32` (mark Sensitive)

- [ ] **Step 5: Trigger deploy**

In Vercel dashboard → Deployments → Redeploy (or push any commit).
Expected: deploy succeeds, URL `https://<project>.vercel.app` returns home page.

- [ ] **Step 6: Configure GH Actions secrets**

On GitHub → repo → Settings → Secrets and variables → Actions → "New repository secret":
- `CRON_BEARER_TOKEN` — same value as Vercel env
- `SITE_URL` — `https://<project>.vercel.app` (no trailing slash)

- [ ] **Step 7: Smoke test deployed cron stub**

```powershell
$token = "<paste CRON_BEARER_TOKEN>"
$url = "https://<project>.vercel.app/api/cron/poll_l2"
curl --fail-with-body -X POST -H "Authorization: Bearer $token" $url
```
Expected: HTTP 501 with `{"job":"poll_l2","status":"not_implemented",...}`. Это значит маршрут жив и авторизация работает — реальная реализация придёт в Plan 2.

- [ ] **Step 8: Manually trigger one GH Actions cron**

GitHub → Actions → "Cron — L2 deal feed" → Run workflow.
Expected: workflow run shows **red** (curl exits non-zero on 501) — это правильный сигнал для стаба. Перейди в логи джобы и проверь, что ответ от сервера: `{"job":"poll_l2","status":"not_implemented",...}` — значит endpoint жив, авторизация прошла, просто реализации ещё нет.

В Plan 2 реальная реализация `poll_l2` начнёт возвращать 200, и при выкатке Plan 2 раскомментируется блок `schedule:` в `cron-l2.yml`.

- [ ] **Step 9: Final verification checklist (manual)**

- [ ] Home page loads at https://<project>.vercel.app
- [ ] `/api/health` returns `{"status":"ok","db":"reachable"}`
- [ ] `/auth/login` renders form
- [ ] Magic link from prod Supabase delivers to user's real email (this requires Supabase Cloud SMTP setup — может пропустить, если первый юзер только в локальной среде; в реальном MVP настроим Resend SMTP в Plan 3)
- [ ] CI workflow runs green on the deploy commit

---

## Plan 1 completion criteria

When all tasks above are checked:
- [ ] Public GitHub repo with first commit pushed
- [ ] Vercel preview/production deploy is healthy
- [ ] Supabase Cloud project created and migrations applied
- [ ] CI passes on `main`
- [ ] At least one GH Actions cron workflow can be triggered manually (even if it returns 501)
- [ ] User can register via magic link in local dev (cloud email setup waits for Plan 3)

**What is NOT in Plan 1 (do not implement here):**
- Travelpayouts API client — Plan 2
- L1/L2/L3 cron logic — Plans 2 and 3
- Layover detection — Plan 4
- Email — Plan 3
- Affiliate links / monetization — Plan 5
- /settings page UI — Plan 3 (when notify flags first matter)
- /status page real content — Plan 2 (when cron_runs starts populating)

Stop here. Run /gsd or your equivalent to start Plan 2 once Plan 1 is green.
