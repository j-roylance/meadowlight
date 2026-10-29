# Meadowlight progress

Source of truth for current product rules: repository implementation + `Meadowlight_Expansion_Prompt.md` (expansion). Older `Meadowlight_Cursor_Spec.md` is historical where it conflicts.

## Mode distinction

| Mode | Status | Notes |
|---|---|---|
| **Local demo** | Implemented & runnable | Persists in `localStorage` (`meadowlight.local_demo.v8`). Feels live by default; name the city **demo** to unlock simulated neighbors + demo tools. |
| **Authenticated multiplayer (Supabase)** | Implemented; requires local/hosted Supabase | Email OTP sign-in/out. Cities in `city_snapshots`. Real directory + portal/send via `/api/game`. Needs `.env.local` URL, anon key, **and** service role key. |

## Compatibility baseline (preserved)

| System | Verified values |
|---|---|
| Resources | coins, wood, stone, research, happiness |
| Starter wallet | 80 / 60 / 40 / 0 / 6 |
| Own-map project work | **0 actions**, materials only |
| Remote project work (demo) | **0 actions**, portal-authorized |
| Manual harvest | 1 action → 25 wood or 25 stone |
| Bank exchange | 1 action; rate × bank count |
| Flower garden L1 / pocket park L1 | happiness 1 / 3 per 12h |
| Research supply run | +20 research |
| Expansion costs | **H = 1** happiness/exploration step; **R = 5** research unit |

## Milestone checklist

### First release
- [x] **M1 Infinite city slice**
- [x] **M2 Complete solo loop**
- [x] **M3 Persistent backend** (schema + snapshot multiplayer path)
- [x] **M4 Portal cooperation** (demo + multiplayer API)
- [x] **M5 Release quality**

### Expansion (`Meadowlight_Expansion_Prompt.md`)
- [x] **E1–E6** — see prior checklist; local demo verified; live path uses same TS rules via snapshots

### Accounts
- [x] Email OTP auth gate + Settings log out
- [x] Cloud-persisted city per account (`city_snapshots`)
- [x] Real-player map directory
- [x] Cross-city portal / parcel / project work / portable gift (API transaction)

## Relevant checks

```bash
npm test          # passing (includes serialize / world service)
npm run typecheck # passing
npm run build     # passing
npm run dev       # Local demo, or multiplayer when .env.local is set
```

Supabase multiplayer:

```bash
npx supabase start
npx supabase db reset
# copy URL, anon, service_role into .env.local
# OTP codes: http://127.0.0.1:54324
```

### Still environment-dependent

- Hosted email delivery / custom SMTP
- Two-account realtime races under production network
- Playwright E2E against a running local stack
