# Meadowlight architecture

## Layers

1. **Definitions** (`src/game/catalog`) — versioned costs, footprints, yields, project targets.
2. **Simulation** (`src/game/simulation`) — pure rules: action windows, production, chunks, roads, placement, projects.
3. **Adapters** (`src/game/adapters`) — `local_demo` (verified) and Supabase multiplayer contract (`supabase/migrations`).
4. **Presentation** (`src/game/rendering`, `src/components`) — isometric SVG, HUD, drawers.

## No-banking windows

```
elapsed_windows = floor((now - action_window_start_at) / 12h)
if elapsed_windows > 0:
  actions_remaining = 2
  action_window_start_at += elapsed_windows * 12h
```

Allowance is **replaced**, never added. Maximum unspent is always 2.

## Chunked infinite maps

- Chunk size 32×32; world coords as `bigint` / decimal strings on API boundaries.
- Floor division for negatives (not truncating toward zero).
- Terrain is deterministic from `(seed, x, y)`; only edits and entities persist.
- Camera uses floating-origin isometric projection (64×32 tiles).

## Portal-gated mutations

Cross-city parcels and project work require:

- Source-owned placed portal
- Matching assignment revision
- Displayed destination ID
- Unique request ID (idempotent)

Friendship, circles, and directory visits never bypass portals.

## Local demo vs genuine multiplayer

| | Local demo | Multiplayer |
|---|---|---|
| Label | Meadowlight (demo tools if city named **demo**) | Authenticated Supabase |
| Persistence | `localStorage` | `city_snapshots` + denormalized `cities` / `city_economy` |
| Neighbors | Simulated when named demo | Real accounts via directory |
| Clock tools | Demo panel only | Forbidden |
| Commands | In-browser world service | `/api/game` + same world service + service role |
| Status | Runnable without credentials | Email OTP + `.env.local` (URL, anon, service role) |

Do not import demo balances into online cities. Shared rules: `src/game/engine/worldService.ts`.
