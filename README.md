# Meadowlight

Cozy asynchronous cooperative city builder for the web. Meaningful progress in one to two minutes a day. Spec: `Meadowlight_Cursor_Spec.md`. Progress: `PROGRESS.md`.

## Visual direction

Stardew Valley–inspired chill meadow: cream sky fade, sage grass, clay roofs, warm window glow, soft water, isometric SVG cottages and workshops.

## Quick start (local demo)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without Supabase env vars the app uses **local demo** (progress in `localStorage`). Name your city **demo** to unlock simulated neighbors and demo tools.

### Ordinary visit

1. Name your city and pick a specialty.
2. Read the return summary (resources accrued, project progress).
3. Spend up to **2 actions** (build, road, portal, send, contribute, supply run).
4. Stop when actions are spent; browse maps for free until the next 12-hour window.

**Two actions per twelve-hour window. Unused actions do not carry over.**

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Next.js app |
| `npm test` | Domain / simulation fixtures (Vitest) |
| `npm run typecheck` | TypeScript |
| `npm run build` | Production build |

## Account login + multiplayer

Cities persist per Supabase Auth account. Sign in with email OTP; log out from Settings. Maps lists real players; portals and parcels work between accounts.

### Local Supabase

Requires Docker + [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
npx supabase start
npx supabase db reset   # applies all migrations including snapshots
```

Copy the printed **API URL**, **anon key**, and **service_role key** into `.env.local` (see `.env.example`). Restart `npm run dev`.

1. Open the app → enter email → request a code.
2. Local OTP mail appears in Inbucket: [http://127.0.0.1:54324](http://127.0.0.1:54324).
3. Complete onboarding; your city is stored in `city_snapshots`.
4. Use a second browser/profile (or another email) for portal tests — never two tabs sharing one session.

### Hosted Supabase

1. Create a project, run migrations (`supabase db push` or SQL editor).
2. Enable Email provider (OTP). Configure SMTP or use the default for testing.
3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` on the host.
4. Set Auth site URL / redirect URLs to your app origin.

`SUPABASE_SERVICE_ROLE_KEY` is server-only (Next.js `/api/game`). Do not put it in client bundles.

## Stack

Next.js App Router, React, TypeScript, Tailwind CSS v4, Vitest, Supabase (Postgres / Auth).

## Architecture notes

- Rules stay in TypeScript (`src/game/simulation`, `src/game/engine/worldService.ts`).
- Multiplayer commands: browser → `/api/game` (JWT) → shared world service → `city_snapshots` JSON.
- Local demo: same world service with `localStorage`.
